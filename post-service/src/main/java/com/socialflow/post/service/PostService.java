package com.socialflow.post.service;

import com.socialflow.post.config.UserPrincipal;
import com.socialflow.post.dto.*;
import com.socialflow.post.event.CommentCreatedEvent;
import com.socialflow.post.event.PostCreatedEvent;
import com.socialflow.post.event.PostDeletedEvent;
import com.socialflow.post.event.PostLikedEvent;
import com.socialflow.post.event.PostRepostedEvent;
import com.socialflow.post.model.*;
import com.socialflow.post.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final PostLikeRepository postLikeRepository;
    private final CommentRepository commentRepository;
    private final PostReactionRepository postReactionRepository;
    private final PostBookmarkRepository postBookmarkRepository;
    private final PollRepository pollRepository;
    private final PollOptionRepository pollOptionRepository;
    private final PollVoteRepository pollVoteRepository;
    private final PostKafkaProducer postKafkaProducer;

    private static final Pattern HASHTAG_PATTERN = Pattern.compile("#(\\w+)");
    private static final Pattern MENTION_PATTERN = Pattern.compile("@(\\w+)");

    @Transactional
    public PostResponseDto createPost(CreatePostRequest request, UserPrincipal currentUser) {
        List<String> tags = request.getTags() != null ? new ArrayList<>(request.getTags()) : new ArrayList<>();
        Set<String> mentions = new HashSet<>();

        Matcher hashtagMatcher = HASHTAG_PATTERN.matcher(request.getContent());
        while (hashtagMatcher.find()) {
            String tag = hashtagMatcher.group(1).toLowerCase();
            if (!tags.contains(tag)) {
                tags.add(tag);
            }
        }

        Matcher mentionMatcher = MENTION_PATTERN.matcher(request.getContent());
        while (mentionMatcher.find()) {
            mentions.add(mentionMatcher.group(1).toLowerCase());
        }

        Post post = Post.builder()
                .authorId(currentUser.getUserId())
                .authorUsername(currentUser.getUsername())
                .content(request.getContent())
                .mediaUrls(request.getMediaUrls() != null ? request.getMediaUrls() : new ArrayList<>())
                .tags(tags)
                .mentions(mentions)
                .visibility(request.getVisibility() != null ? request.getVisibility() : "PUBLIC")
                .likesCount(0)
                .commentsCount(0)
                .repostsCount(0)
                .isPinned(false)
                .build();

        Post savedPost = postRepository.save(post);

        if (request.getPoll() != null && request.getPoll().getOptions() != null && request.getPoll().getOptions().size() >= 2) {
            CreatePollRequest pollReq = request.getPoll();
            int hours = pollReq.getDurationHours() > 0 ? pollReq.getDurationHours() : 24;
            Poll poll = Poll.builder()
                    .post(savedPost)
                    .question(pollReq.getQuestion())
                    .expiresAt(LocalDateTime.now().plusHours(hours))
                    .build();

            List<PollOption> options = new ArrayList<>();
            for (String optText : pollReq.getOptions()) {
                options.add(PollOption.builder()
                        .poll(poll)
                        .text(optText)
                        .voteCount(0)
                        .build());
            }
            poll.setOptions(options);
            savedPost.setPoll(poll);
            pollRepository.save(poll);
        }

        postKafkaProducer.emitPostCreated(PostCreatedEvent.builder()
                .postId(savedPost.getId())
                .authorId(savedPost.getAuthorId())
                .authorUsername(savedPost.getAuthorUsername())
                .content(savedPost.getContent())
                .mediaUrls(savedPost.getMediaUrls())
                .tags(savedPost.getTags())
                .mentions(savedPost.getMentions())
                .hasPoll(savedPost.getPoll() != null)
                .isRepost(savedPost.isRepost())
                .originalPostId(savedPost.getOriginalPostId())
                .visibility(savedPost.getVisibility())
                .createdAt(savedPost.getCreatedAt())
                .build());

        return mapToDto(savedPost, currentUser.getUserId());
    }

    @Transactional
    public PostResponseDto repost(Long postId, RepostRequest request, UserPrincipal currentUser) {
        Post original = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Original post not found: " + postId));

        original.setRepostsCount(original.getRepostsCount() + 1);
        postRepository.save(original);

        String content = request != null && request.getQuoteComment() != null ? request.getQuoteComment() : "";

        Post repost = Post.builder()
                .authorId(currentUser.getUserId())
                .authorUsername(currentUser.getUsername())
                .content(content)
                .isRepost(true)
                .originalPostId(original.getId())
                .quoteComment(request != null ? request.getQuoteComment() : null)
                .visibility("PUBLIC")
                .build();

        Post savedRepost = postRepository.save(repost);

        postKafkaProducer.emitPostReposted(PostRepostedEvent.builder()
                .repostId(savedRepost.getId())
                .originalPostId(original.getId())
                .authorId(currentUser.getUserId())
                .authorUsername(currentUser.getUsername())
                .quoteComment(repost.getQuoteComment())
                .createdAt(savedRepost.getCreatedAt())
                .build());

        return mapToDto(savedRepost, currentUser.getUserId());
    }

    public PostResponseDto getPostById(Long postId, Long currentUserId) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found with id: " + postId));
        return mapToDto(post, currentUserId);
    }

    public Page<PostResponseDto> getUserPosts(Long userId, int page, int size, Long currentUserId) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("isPinned").descending().and(Sort.by("createdAt").descending()));
        return postRepository.findByAuthorIdOrderByCreatedAtDesc(userId, pageRequest)
                .map(post -> mapToDto(post, currentUserId));
    }

    @Transactional
    public boolean toggleLike(Long postId, UserPrincipal currentUser) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found with id: " + postId));

        boolean alreadyLiked = postLikeRepository.existsByPostIdAndUserId(postId, currentUser.getUserId());
        boolean likedNow;

        if (alreadyLiked) {
            postLikeRepository.deleteByPostIdAndUserId(postId, currentUser.getUserId());
            post.setLikesCount(Math.max(0, post.getLikesCount() - 1));
            likedNow = false;
        } else {
            postLikeRepository.save(PostLike.builder()
                    .postId(postId)
                    .userId(currentUser.getUserId())
                    .username(currentUser.getUsername())
                    .build());
            post.setLikesCount(post.getLikesCount() + 1);
            likedNow = true;
        }

        postRepository.save(post);

        postKafkaProducer.emitPostLiked(PostLikedEvent.builder()
                .postId(postId)
                .userId(currentUser.getUserId())
                .username(currentUser.getUsername())
                .authorId(post.getAuthorId())
                .liked(likedNow)
                .build());

        return likedNow;
    }

    @Transactional
    public ReactionSummaryDto addOrUpdateReaction(Long postId, ReactionType reactionType, UserPrincipal currentUser) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found: " + postId));

        Optional<PostReaction> existingOpt = postReactionRepository.findByPostIdAndUserId(postId, currentUser.getUserId());
        ReactionType activeReaction = null;

        if (existingOpt.isPresent()) {
            PostReaction existing = existingOpt.get();
            if (existing.getReactionType() == reactionType) {
                postReactionRepository.delete(existing);
                post.setLikesCount(Math.max(0, post.getLikesCount() - 1));
            } else {
                existing.setReactionType(reactionType);
                postReactionRepository.save(existing);
                activeReaction = reactionType;
            }
        } else {
            postReactionRepository.save(PostReaction.builder()
                    .post(post)
                    .userId(currentUser.getUserId())
                    .username(currentUser.getUsername())
                    .reactionType(reactionType)
                    .build());
            post.setLikesCount(post.getLikesCount() + 1);
            activeReaction = reactionType;
        }

        postRepository.save(post);
        return getReactionSummary(postId, activeReaction);
    }

    public ReactionSummaryDto getReactionSummary(Long postId, ReactionType userReaction) {
        List<PostReaction> reactions = postReactionRepository.findByPostId(postId);
        Map<ReactionType, Long> counts = reactions.stream()
                .collect(Collectors.groupingBy(PostReaction::getReactionType, Collectors.counting()));

        return ReactionSummaryDto.builder()
                .postId(postId)
                .totalReactions(reactions.size())
                .countsByType(counts)
                .userReaction(userReaction)
                .build();
    }

    @Transactional
    public boolean toggleBookmark(Long postId, UserPrincipal currentUser) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found: " + postId));

        boolean alreadyBookmarked = postBookmarkRepository.existsByPostIdAndUserId(postId, currentUser.getUserId());
        if (alreadyBookmarked) {
            postBookmarkRepository.deleteByPostIdAndUserId(postId, currentUser.getUserId());
            return false;
        } else {
            postBookmarkRepository.save(PostBookmark.builder()
                    .post(post)
                    .userId(currentUser.getUserId())
                    .build());
            return true;
        }
    }

    public Page<PostResponseDto> getBookmarkedPosts(int page, int size, UserPrincipal currentUser) {
        PageRequest pageRequest = PageRequest.of(page, size);
        return postBookmarkRepository.findByUserIdOrderByCreatedAtDesc(currentUser.getUserId(), pageRequest)
                .map(bm -> mapToDto(bm.getPost(), currentUser.getUserId()));
    }

    @Transactional
    public boolean togglePin(Long postId, UserPrincipal currentUser) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found: " + postId));

        if (!post.getAuthorId().equals(currentUser.getUserId())) {
            throw new IllegalArgumentException("Unauthorized: You can only pin your own posts");
        }

        post.setPinned(!post.isPinned());
        postRepository.save(post);
        return post.isPinned();
    }

    @Transactional
    public PollResponseDto votePoll(Long postId, Long optionId, UserPrincipal currentUser) {
        Poll poll = pollRepository.findByPostId(postId)
                .orElseThrow(() -> new IllegalArgumentException("Poll not found for post: " + postId));

        if (poll.isExpired()) {
            throw new IllegalStateException("Poll has expired");
        }

        if (pollVoteRepository.existsByPollIdAndUserId(poll.getId(), currentUser.getUserId())) {
            throw new IllegalStateException("User already voted on this poll");
        }

        PollOption option = pollOptionRepository.findById(optionId)
                .orElseThrow(() -> new IllegalArgumentException("Poll option not found: " + optionId));

        if (!option.getPoll().getId().equals(poll.getId())) {
            throw new IllegalArgumentException("Option does not belong to this poll");
        }

        option.setVoteCount(option.getVoteCount() + 1);
        pollOptionRepository.save(option);

        pollVoteRepository.save(PollVote.builder()
                .pollId(poll.getId())
                .optionId(optionId)
                .userId(currentUser.getUserId())
                .build());

        return mapPollToDto(poll, currentUser.getUserId());
    }

    @Transactional
    public CommentResponseDto addComment(Long postId, CommentRequest request, UserPrincipal currentUser) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found with id: " + postId));

        Comment comment = Comment.builder()
                .postId(postId)
                .authorId(currentUser.getUserId())
                .authorUsername(currentUser.getUsername())
                .content(request.getContent())
                .build();

        Comment savedComment = commentRepository.save(comment);

        post.setCommentsCount(post.getCommentsCount() + 1);
        postRepository.save(post);

        postKafkaProducer.emitCommentCreated(CommentCreatedEvent.builder()
                .commentId(savedComment.getId())
                .postId(postId)
                .authorId(currentUser.getUserId())
                .authorUsername(currentUser.getUsername())
                .postAuthorId(post.getAuthorId())
                .content(request.getContent())
                .build());

        return mapCommentToDto(savedComment);
    }

    public List<CommentResponseDto> getComments(Long postId) {
        return commentRepository.findByPostIdOrderByCreatedAtAsc(postId)
                .stream()
                .map(this::mapCommentToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deletePost(Long postId, UserPrincipal currentUser) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("Post not found with id: " + postId));

        if (!post.getAuthorId().equals(currentUser.getUserId())) {
            throw new IllegalArgumentException("Unauthorized: You can only delete your own posts");
        }

        postRepository.delete(post);

        postKafkaProducer.emitPostDeleted(PostDeletedEvent.builder()
                .postId(postId)
                .authorId(currentUser.getUserId())
                .build());
    }

    private PostResponseDto mapToDto(Post post, Long currentUserId) {
        boolean isLiked = currentUserId != null && postLikeRepository.existsByPostIdAndUserId(post.getId(), currentUserId);
        boolean isBookmarked = currentUserId != null && postBookmarkRepository.existsByPostIdAndUserId(post.getId(), currentUserId);

        ReactionType userReaction = null;
        if (currentUserId != null) {
            userReaction = postReactionRepository.findByPostIdAndUserId(post.getId(), currentUserId)
                    .map(PostReaction::getReactionType)
                    .orElse(null);
        }

        PollResponseDto pollDto = null;
        if (post.getPoll() != null) {
            pollDto = mapPollToDto(post.getPoll(), currentUserId);
        }

        PostResponseDto originalPostDto = null;
        if (post.isRepost() && post.getOriginalPostId() != null) {
            originalPostDto = postRepository.findById(post.getOriginalPostId())
                    .map(op -> mapToDto(op, currentUserId))
                    .orElse(null);
        }

        return PostResponseDto.builder()
                .id(post.getId())
                .authorId(post.getAuthorId())
                .authorUsername(post.getAuthorUsername())
                .authorAvatar(post.getAuthorAvatar())
                .content(post.getContent())
                .mediaUrls(post.getMediaUrls())
                .tags(post.getTags())
                .mentions(post.getMentions())
                .likesCount(post.getLikesCount())
                .commentsCount(post.getCommentsCount())
                .repostsCount(post.getRepostsCount())
                .isLiked(isLiked)
                .isBookmarked(isBookmarked)
                .isPinned(post.isPinned())
                .visibility(post.getVisibility())
                .isRepost(post.isRepost())
                .originalPostId(post.getOriginalPostId())
                .quoteComment(post.getQuoteComment())
                .originalPost(originalPostDto)
                .poll(pollDto)
                .userReaction(userReaction)
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .build();
    }

    private PollResponseDto mapPollToDto(Poll poll, Long currentUserId) {
        long totalVotes = pollVoteRepository.countByPollId(poll.getId());
        Long userSelectedOptionId = null;
        boolean hasVoted = false;

        if (currentUserId != null) {
            Optional<PollVote> voteOpt = pollVoteRepository.findByPollIdAndUserId(poll.getId(), currentUserId);
            if (voteOpt.isPresent()) {
                hasVoted = true;
                userSelectedOptionId = voteOpt.get().getOptionId();
            }
        }

        final Long finalSelected = userSelectedOptionId;
        List<PollOptionDto> optionDtos = poll.getOptions().stream().map(opt -> {
            double pct = totalVotes > 0 ? ((double) opt.getVoteCount() / totalVotes) * 100.0 : 0.0;
            return PollOptionDto.builder()
                    .id(opt.getId())
                    .text(opt.getText())
                    .voteCount(opt.getVoteCount())
                    .percentage(Math.round(pct * 10.0) / 10.0)
                    .isSelected(finalSelected != null && finalSelected.equals(opt.getId()))
                    .build();
        }).collect(Collectors.toList());

        return PollResponseDto.builder()
                .id(poll.getId())
                .question(poll.getQuestion())
                .options(optionDtos)
                .totalVotes((int) totalVotes)
                .isExpired(poll.isExpired())
                .hasVoted(hasVoted)
                .selectedOptionId(userSelectedOptionId)
                .expiresAt(poll.getExpiresAt())
                .build();
    }

    private CommentResponseDto mapCommentToDto(Comment comment) {
        return CommentResponseDto.builder()
                .id(comment.getId())
                .postId(comment.getPostId())
                .authorId(comment.getAuthorId())
                .authorUsername(comment.getAuthorUsername())
                .authorAvatar(comment.getAuthorAvatar())
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt())
                .build();
    }
}