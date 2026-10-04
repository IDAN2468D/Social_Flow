package com.socialflow.feed.service;

import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.dto.TrendingTagDto;
import com.socialflow.feed.model.FollowerRelation;
import com.socialflow.feed.repository.FollowerRelationRepository;
import com.socialflow.feed.repository.PostElasticsearchRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedService {

    private final PostElasticsearchRepository postSearchRepository;
    private final FollowerRelationRepository followerRelationRepository;

    public Page<PostDocument> getFollowingFeed(Long userId, int page, int size) {
        List<FollowerRelation> following = followerRelationRepository.findByFollowerId(userId);
        List<Long> followingIds = following.stream()
                .map(FollowerRelation::getFollowingId)
                .collect(Collectors.toList());

        followingIds.add(userId);

        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return postSearchRepository.findByAuthorIdInOrderByCreatedAtDesc(followingIds, pageRequest);
    }

    public Page<PostDocument> getForYouFeed(Long userId, int page, int size) {
        try {
            Set<Long> followedIds = new HashSet<>();
            if (userId != null) {
                followerRelationRepository.findByFollowerId(userId)
                        .forEach(f -> followedIds.add(f.getFollowingId()));
                followedIds.add(userId);
            }

            PageRequest candidateRequest = PageRequest.of(0, 100, Sort.by("createdAt").descending());
            Page<PostDocument> candidatePage = postSearchRepository.findAllByOrderByCreatedAtDesc(candidateRequest);
            List<PostDocument> candidates = new ArrayList<>(candidatePage.getContent());

            LocalDateTime now = LocalDateTime.now();

            for (PostDocument doc : candidates) {
                long hoursOld = doc.getCreatedAt() != null ? Math.max(0, Duration.between(doc.getCreatedAt(), now).toHours()) : 0;
                double recencyFactor = Math.max(0.1, 100.0 / (1.0 + Math.pow(hoursOld / 12.0, 1.5)));
                double interactionScore = (doc.getLikesCount() * 2.0) + (doc.getCommentsCount() * 3.0) + (doc.getRepostsCount() * 4.0);
                double followingBonus = (doc.getAuthorId() != null && followedIds.contains(doc.getAuthorId())) ? 30.0 : 0.0;

                doc.setEngagementScore(Math.round((interactionScore + recencyFactor + followingBonus) * 100.0) / 100.0);
            }

            candidates.sort((a, b) -> Double.compare(b.getEngagementScore(), a.getEngagementScore()));

            int start = Math.min(page * size, candidates.size());
            int end = Math.min(start + size, candidates.size());
            List<PostDocument> paginated = candidates.subList(start, end);

            return new PageImpl<>(paginated, PageRequest.of(page, size), candidates.size());
        } catch (Exception e) {
            return new PageImpl<>(Collections.emptyList(), PageRequest.of(page, size), 0);
        }
    }

    public Page<PostDocument> getTrendingFeed(int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("likesCount").descending());
        return postSearchRepository.findAllByOrderByLikesCountDesc(pageRequest);
    }

    public Page<PostDocument> getUserProfileFeed(Long authorId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        return postSearchRepository.findByAuthorIdOrderByIsPinnedDescCreatedAtDesc(authorId, pageRequest);
    }

    public List<TrendingTagDto> getTrendingHashtags(int limit) {
        try {
            PageRequest candidateRequest = PageRequest.of(0, 150, Sort.by("createdAt").descending());
            Page<PostDocument> recentPosts = postSearchRepository.findAllByOrderByCreatedAtDesc(candidateRequest);

            Map<String, Long> tagCounts = new HashMap<>();
            for (PostDocument doc : recentPosts.getContent()) {
                if (doc.getTags() != null) {
                    for (String tag : doc.getTags()) {
                        String clean = tag.toLowerCase().trim();
                        tagCounts.put(clean, tagCounts.getOrDefault(clean, 0L) + 1L);
                    }
                }
            }

            return tagCounts.entrySet().stream()
                    .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                    .limit(limit > 0 ? limit : 10)
                    .map(entry -> TrendingTagDto.builder()
                            .tag(entry.getKey())
                            .count(entry.getValue())
                            .category("Trending in SocialFlow")
                            .build())
                    .collect(Collectors.toList());
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    public Page<PostDocument> searchPosts(String query, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        if (query == null || query.trim().isEmpty()) {
            return postSearchRepository.findAllByOrderByCreatedAtDesc(pageRequest);
        }
        return postSearchRepository.findByContentContainingIgnoreCase(query.trim(), pageRequest);
    }

    public Page<PostDocument> searchByTag(String tag, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        if (tag == null || tag.trim().isEmpty()) {
            return postSearchRepository.findAllByOrderByCreatedAtDesc(pageRequest);
        }
        String clean = tag.trim().replace("#", "");
        return postSearchRepository.findByTagsContaining(clean, pageRequest);
    }
}