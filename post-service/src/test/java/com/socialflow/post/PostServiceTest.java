package com.socialflow.post;

import com.socialflow.post.config.UserPrincipal;
import com.socialflow.post.controller.PostController;
import com.socialflow.post.controller.StoryController;
import com.socialflow.post.dto.*;
import com.socialflow.post.event.PostCreatedEvent;
import com.socialflow.post.event.PostDeletedEvent;
import com.socialflow.post.event.PostLikedEvent;
import com.socialflow.post.event.PostPinnedEvent;
import com.socialflow.post.event.PostRepostedEvent;
import com.socialflow.post.model.*;
import com.socialflow.post.repository.*;
import com.socialflow.post.service.PostKafkaProducer;
import com.socialflow.post.service.PostService;
import com.socialflow.post.service.StoryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PostServiceTest {

    @Mock
    private PostRepository postRepository;

    @Mock
    private PostLikeRepository postLikeRepository;

    @Mock
    private CommentRepository commentRepository;

    @Mock
    private PostReactionRepository postReactionRepository;

    @Mock
    private PostBookmarkRepository postBookmarkRepository;

    @Mock
    private PollRepository pollRepository;

    @Mock
    private PollOptionRepository pollOptionRepository;

    @Mock
    private PollVoteRepository pollVoteRepository;

    @Mock
    private StoryRepository storyRepository;

    @Mock
    private PostKafkaProducer postKafkaProducer;

    @InjectMocks
    private PostService postService;

    @InjectMocks
    private StoryService storyService;

    private UserPrincipal testUser;

    @BeforeEach
    void setUp() {
        testUser = new UserPrincipal(100L, "idan");
    }

    @Test
    @DisplayName("createPost creates post and emits kafka event")
    void createPost_Success() {
        CreatePostRequest request = CreatePostRequest.builder()
                .content("Hello #world and @dan")
                .visibility("PUBLIC")
                .build();

        Post savedPost = Post.builder()
                .id(1L)
                .authorId(testUser.getUserId())
                .authorUsername(testUser.getUsername())
                .content(request.getContent())
                .visibility("PUBLIC")
                .likesCount(0)
                .commentsCount(0)
                .repostsCount(0)
                .createdAt(LocalDateTime.now())
                .tags(List.of("world"))
                .mentions(Set.of("dan"))
                .build();

        when(postRepository.save(any(Post.class))).thenReturn(savedPost);

        PostResponseDto result = postService.createPost(request, testUser);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getContent()).isEqualTo("Hello #world and @dan");
        verify(postKafkaProducer, times(1)).emitPostCreated(any(PostCreatedEvent.class));
    }

    @Test
    @DisplayName("toggleLike adds like when not previously liked")
    void toggleLike_AddsLike() {
        Post post = Post.builder()
                .id(1L)
                .authorId(200L)
                .likesCount(0)
                .build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(post));
        when(postLikeRepository.existsByPostIdAndUserId(1L, 100L)).thenReturn(false);
        when(postRepository.save(any(Post.class))).thenReturn(post);

        boolean liked = postService.toggleLike(1L, testUser);

        assertThat(liked).isTrue();
        assertThat(post.getLikesCount()).isEqualTo(1);
        verify(postLikeRepository, times(1)).save(any(PostLike.class));
        verify(postKafkaProducer, times(1)).emitPostLiked(any(PostLikedEvent.class));
    }

    @Test
    @DisplayName("toggleLike removes like when already liked")
    void toggleLike_RemovesLike() {
        Post post = Post.builder()
                .id(1L)
                .authorId(200L)
                .likesCount(1)
                .build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(post));
        when(postLikeRepository.existsByPostIdAndUserId(1L, 100L)).thenReturn(true);
        when(postRepository.save(any(Post.class))).thenReturn(post);

        boolean liked = postService.toggleLike(1L, testUser);

        assertThat(liked).isFalse();
        assertThat(post.getLikesCount()).isEqualTo(0);
        verify(postLikeRepository, times(1)).deleteByPostIdAndUserId(1L, 100L);
        verify(postKafkaProducer, times(1)).emitPostLiked(any(PostLikedEvent.class));
    }

    @Test
    @DisplayName("repost increments repostsCount and emits kafka event")
    void repost_Success() {
        Post original = Post.builder()
                .id(1L)
                .authorId(200L)
                .authorUsername("other")
                .repostsCount(0)
                .build();

        Post savedRepost = Post.builder()
                .id(2L)
                .authorId(100L)
                .authorUsername("idan")
                .isRepost(true)
                .originalPostId(1L)
                .quoteComment("Nice post!")
                .visibility("PUBLIC")
                .createdAt(LocalDateTime.now())
                .build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(original));
        when(postRepository.save(any(Post.class))).thenReturn(original).thenReturn(savedRepost);

        RepostRequest req = RepostRequest.builder().quoteComment("Nice post!").build();
        PostResponseDto result = postService.repost(1L, req, testUser);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(2L);
        assertThat(original.getRepostsCount()).isEqualTo(1);
        verify(postKafkaProducer, times(1)).emitPostReposted(any(PostRepostedEvent.class));
    }

    @Test
    @DisplayName("votePoll throws exception if user already voted")
    void votePoll_AlreadyVoted_Throws() {
        Poll poll = Poll.builder()
                .id(10L)
                .expiresAt(LocalDateTime.now().plusHours(10))
                .build();

        when(pollRepository.findByPostId(1L)).thenReturn(Optional.of(poll));
        when(pollVoteRepository.existsByPollIdAndUserId(10L, 100L)).thenReturn(true);

        assertThatThrownBy(() -> postService.votePoll(1L, 5L, testUser))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("User already voted");
    }

    @Test
    @DisplayName("togglePin throws exception if user is not author")
    void togglePin_Unauthorized_Throws() {
        Post post = Post.builder()
                .id(1L)
                .authorId(999L)
                .build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> postService.togglePin(1L, testUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unauthorized: You can only pin your own posts");
    }

    @Test
    @DisplayName("togglePin toggles pin state and emits PostPinnedEvent")
    void togglePin_Success_EmitsEvent() {
        Post post = Post.builder()
                .id(1L)
                .authorId(100L)
                .isPinned(false)
                .build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(post));
        when(postRepository.save(any(Post.class))).thenReturn(post);

        boolean pinned = postService.togglePin(1L, testUser);

        assertThat(pinned).isTrue();
        ArgumentCaptor<PostPinnedEvent> captor = ArgumentCaptor.forClass(PostPinnedEvent.class);
        verify(postKafkaProducer, times(1)).emitPostPinned(captor.capture());
        assertThat(captor.getValue().getPostId()).isEqualTo(1L);
        assertThat(captor.getValue().getAuthorId()).isEqualTo(100L);
        assertThat(captor.getValue().isPinned()).isTrue();
        assertThat(captor.getValue().getEventType()).isEqualTo("POST_PINNED");
    }

    @Test
    @DisplayName("getReactionSummaryForUser and PostController resolve user reaction")
    void getReactionSummary_ForUser_ResolvesUserReaction() {
        Post post = Post.builder().id(1L).authorId(200L).build();
        PostReaction userReaction = PostReaction.builder()
                .id(10L)
                .post(post)
                .userId(100L)
                .username("idan")
                .reactionType(ReactionType.CELEBRATE)
                .build();
        PostReaction otherReaction = PostReaction.builder()
                .id(11L)
                .post(post)
                .userId(200L)
                .username("noa")
                .reactionType(ReactionType.LIKE)
                .build();

        when(postReactionRepository.findByPostIdAndUserId(1L, 100L)).thenReturn(Optional.of(userReaction));
        when(postReactionRepository.findByPostId(1L)).thenReturn(List.of(userReaction, otherReaction));

        PostController controller = new PostController(postService);
        ResponseEntity<ReactionSummaryDto> response = controller.getReactionSummary(1L, testUser);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getTotalReactions()).isEqualTo(2);
        assertThat(response.getBody().getUserReaction()).isEqualTo(ReactionType.CELEBRATE);
        assertThat(response.getBody().getCountsByType()).containsEntry(ReactionType.CELEBRATE, 1L);
        assertThat(response.getBody().getCountsByType()).containsEntry(ReactionType.LIKE, 1L);
    }

    @Test
    @DisplayName("addOrUpdateReaction emits PostLikedEvent on add and remove, not on type switch")
    void addOrUpdateReaction_EmitsKafkaOnAddAndRemove() {
        Post post = Post.builder()
                .id(1L)
                .authorId(200L)
                .likesCount(0)
                .build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(post));
        when(postRepository.save(any(Post.class))).thenReturn(post);
        when(postReactionRepository.findByPostId(1L)).thenReturn(List.of());

        // 1. Add reaction -> emits liked=true
        when(postReactionRepository.findByPostIdAndUserId(1L, 100L)).thenReturn(Optional.empty());
        ReactionSummaryDto added = postService.addOrUpdateReaction(1L, ReactionType.LOVE, testUser);
        assertThat(added.getUserReaction()).isEqualTo(ReactionType.LOVE);
        assertThat(post.getLikesCount()).isEqualTo(1);

        ArgumentCaptor<PostLikedEvent> eventCaptor = ArgumentCaptor.forClass(PostLikedEvent.class);
        verify(postKafkaProducer, times(1)).emitPostLiked(eventCaptor.capture());
        assertThat(eventCaptor.getValue().isLiked()).isTrue();
        assertThat(eventCaptor.getValue().getEventType()).isEqualTo("POST_LIKED");

        // 2. Switch reaction type -> does NOT emit duplicate event
        PostReaction existing = PostReaction.builder()
                .id(5L)
                .post(post)
                .userId(100L)
                .username("idan")
                .reactionType(ReactionType.LOVE)
                .build();
        when(postReactionRepository.findByPostIdAndUserId(1L, 100L)).thenReturn(Optional.of(existing));
        ReactionSummaryDto switched = postService.addOrUpdateReaction(1L, ReactionType.CELEBRATE, testUser);
        assertThat(switched.getUserReaction()).isEqualTo(ReactionType.CELEBRATE);
        assertThat(post.getLikesCount()).isEqualTo(1);
        verify(postKafkaProducer, times(1)).emitPostLiked(any(PostLikedEvent.class));

        // 3. Toggle same reaction off -> emits liked=false
        ReactionSummaryDto removed = postService.addOrUpdateReaction(1L, ReactionType.CELEBRATE, testUser);
        assertThat(removed.getUserReaction()).isNull();
        assertThat(post.getLikesCount()).isEqualTo(0);
        verify(postKafkaProducer, times(2)).emitPostLiked(eventCaptor.capture());
        assertThat(eventCaptor.getValue().isLiked()).isFalse();
    }

    @Test
    @DisplayName("StoryService and StoryController create 24h stories and return active ones")
    void stories_CreateAndGetActiveStories() {
        CreateStoryRequest request = CreateStoryRequest.builder()
                .mediaUrl("https://example.com/story.jpg")
                .caption("New release!")
                .userAvatar("https://example.com/avatar.png")
                .build();

        when(storyRepository.save(any(Story.class))).thenAnswer(invocation -> {
            Story s = invocation.getArgument(0);
            s.setId(42L);
            return s;
        });

        StoryController storyController = new StoryController(storyService);
        ResponseEntity<StoryResponseDto> created = storyController.createStory(request, null, "100", "idan");

        assertThat(created.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(created.getBody()).isNotNull();
        assertThat(created.getBody().getId()).isEqualTo(42L);
        assertThat(created.getBody().getUserId()).isEqualTo(100L);
        assertThat(created.getBody().getUsername()).isEqualTo("idan");
        assertThat(Duration.between(created.getBody().getCreatedAt(), created.getBody().getExpiresAt()).toHours())
                .isEqualTo(24L);

        ResponseEntity<StoryResponseDto> unauthorized = storyController.createStory(request, null, null, null);
        assertThat(unauthorized.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        Story activeStory = Story.builder()
                .id(42L)
                .userId(100L)
                .username("idan")
                .mediaUrl("https://example.com/story.jpg")
                .caption("New release!")
                .createdAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusHours(23))
                .build();
        when(storyRepository.findByExpiresAtAfterOrderByCreatedAtDesc(any(LocalDateTime.class)))
                .thenReturn(List.of(activeStory));

        ResponseEntity<List<StoryResponseDto>> activeList = storyController.getActiveStories();
        assertThat(activeList.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(activeList.getBody()).hasSize(1);
        assertThat(activeList.getBody().get(0).getCaption()).isEqualTo("New release!");
    }

    @Test
    @DisplayName("deletePost allows owner or ADMIN and blocks non-owner USER")
    void deletePost_OwnershipAndAdmin() {
        Post post = Post.builder().id(77L).authorId(100L).authorUsername("idan").content("Hello").build();
        when(postRepository.findById(77L)).thenReturn(Optional.of(post));

        UserPrincipal nonOwner = new UserPrincipal(200L, "noa", "USER");
        assertThatThrownBy(() -> postService.deletePost(77L, nonOwner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unauthorized");

        UserPrincipal admin = new UserPrincipal(999L, "admin", "ADMIN");
        postService.deletePost(77L, admin);

        verify(postRepository, times(1)).delete(post);
        verify(postKafkaProducer, times(1)).emitPostDeleted(any(PostDeletedEvent.class));
    }
}
