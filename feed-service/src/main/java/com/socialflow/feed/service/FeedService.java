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
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        try {
            List<FollowerRelation> following = followerRelationRepository.findByFollowerId(userId);
            List<Long> followingIds = following.stream()
                    .map(FollowerRelation::getFollowingId)
                    .collect(Collectors.toList());

            followingIds.add(userId);
            return filterVisiblePage(postSearchRepository.findByAuthorIdInOrderByCreatedAtDesc(followingIds, pageRequest), pageRequest);
        } catch (Exception e) {
            return new PageImpl<>(Collections.emptyList(), pageRequest, 0);
        }
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
            List<PostDocument> candidates = candidatePage.getContent().stream()
                    .filter(this::isVisible)
                    .collect(Collectors.toCollection(ArrayList::new));

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
        try {
            return filterVisiblePage(postSearchRepository.findAllByOrderByLikesCountDesc(pageRequest), pageRequest);
        } catch (Exception e) {
            return new PageImpl<>(Collections.emptyList(), pageRequest, 0);
        }
    }

    public Page<PostDocument> getUserProfileFeed(Long authorId, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size);
        try {
            return filterVisiblePage(postSearchRepository.findByAuthorIdOrderByIsPinnedDescCreatedAtDesc(authorId, pageRequest), pageRequest);
        } catch (Exception e) {
            return new PageImpl<>(Collections.emptyList(), pageRequest, 0);
        }
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
        try {
            if (query == null || query.trim().isEmpty()) {
                return filterVisiblePage(postSearchRepository.findAllByOrderByCreatedAtDesc(pageRequest), pageRequest);
            }
            return filterVisiblePage(postSearchRepository.findByContentContainingIgnoreCase(query.trim(), pageRequest), pageRequest);
        } catch (Exception e) {
            return new PageImpl<>(Collections.emptyList(), pageRequest, 0);
        }
    }

    public Page<PostDocument> searchByTag(String tag, int page, int size) {
        PageRequest pageRequest = PageRequest.of(page, size, Sort.by("createdAt").descending());
        try {
            if (tag == null || tag.trim().isEmpty()) {
                return filterVisiblePage(postSearchRepository.findAllByOrderByCreatedAtDesc(pageRequest), pageRequest);
            }
            String clean = tag.trim().replace("#", "");
            return filterVisiblePage(postSearchRepository.findByTagsContaining(clean, pageRequest), pageRequest);
        } catch (Exception e) {
            return new PageImpl<>(Collections.emptyList(), pageRequest, 0);
        }
    }

    public Map<String, Object> searchMulti(String query, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = size > 0 ? size : 10;
        String raw = query != null ? query.trim() : "";
        String clean = raw.startsWith("#") ? raw.substring(1).trim() : raw;
        String lowerQuery = clean.toLowerCase();

        try {
            Map<String, PostDocument> matchedPostsMap = new LinkedHashMap<>();
            Map<String, PostDocument> allCandidatesMap = new LinkedHashMap<>();

            if (clean.isEmpty()) {
                Page<PostDocument> allPage = postSearchRepository.findAllByOrderByCreatedAtDesc(
                        PageRequest.of(0, 150, Sort.by("createdAt").descending()));
                if (allPage != null && allPage.getContent() != null) {
                    for (PostDocument doc : allPage.getContent()) {
                        addCandidate(matchedPostsMap, doc);
                        addCandidate(allCandidatesMap, doc);
                    }
                }
            } else {
                Page<PostDocument> contentPage = postSearchRepository.findByContentContainingIgnoreCase(
                        clean, PageRequest.of(0, 100, Sort.by("createdAt").descending()));
                if (contentPage != null && contentPage.getContent() != null) {
                    for (PostDocument doc : contentPage.getContent()) {
                        addCandidate(matchedPostsMap, doc);
                        addCandidate(allCandidatesMap, doc);
                    }
                }

                Page<PostDocument> recentPage = postSearchRepository.findAllByOrderByCreatedAtDesc(
                        PageRequest.of(0, 150, Sort.by("createdAt").descending()));
                if (recentPage != null && recentPage.getContent() != null) {
                    for (PostDocument doc : recentPage.getContent()) {
                        addCandidate(allCandidatesMap, doc);
                        if (matchesPost(doc, lowerQuery)) {
                            addCandidate(matchedPostsMap, doc);
                        }
                    }
                }
            }

            List<PostDocument> matchedPosts = new ArrayList<>(matchedPostsMap.values());
            int start = Math.min(safePage * safeSize, matchedPosts.size());
            int end = Math.min(start + safeSize, matchedPosts.size());
            List<PostDocument> paginatedPosts = new ArrayList<>(matchedPosts.subList(start, end));

            Map<String, Map<String, String>> usersByLowerUsername = new LinkedHashMap<>();
            for (PostDocument doc : allCandidatesMap.values()) {
                String username = doc.getAuthorUsername();
                if (username == null || username.isBlank()) {
                    continue;
                }
                boolean matchesUser = lowerQuery.isEmpty()
                        || username.toLowerCase().contains(lowerQuery)
                        || (doc.getContent() != null && doc.getContent().toLowerCase().contains(lowerQuery));
                if (!matchesUser) {
                    continue;
                }
                String key = username.toLowerCase();
                String avatar = doc.getAuthorAvatar() != null ? doc.getAuthorAvatar() : "";
                Map<String, String> existing = usersByLowerUsername.get(key);
                if (existing == null) {
                    Map<String, String> userMap = new LinkedHashMap<>();
                    userMap.put("username", username);
                    userMap.put("avatar", avatar);
                    usersByLowerUsername.put(key, userMap);
                } else if (existing.get("avatar").isEmpty() && !avatar.isEmpty()) {
                    existing.put("avatar", avatar);
                }
            }
            List<Map<String, String>> matchedUsers = usersByLowerUsername.values().stream()
                    .limit(safeSize)
                    .collect(Collectors.toList());

            Map<String, Long> tagCounts = new HashMap<>();
            for (PostDocument doc : allCandidatesMap.values()) {
                if (doc.getTags() != null) {
                    for (String tag : doc.getTags()) {
                        if (tag == null || tag.isBlank()) {
                            continue;
                        }
                        String cleanTag = tag.trim().toLowerCase();
                        if (lowerQuery.isEmpty() || cleanTag.contains(lowerQuery)) {
                            tagCounts.put(cleanTag, tagCounts.getOrDefault(cleanTag, 0L) + 1L);
                        }
                    }
                }
            }
            List<Map<String, Object>> matchedTags = tagCounts.entrySet().stream()
                    .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                    .limit(safeSize)
                    .map(entry -> {
                        Map<String, Object> tagMap = new LinkedHashMap<>();
                        tagMap.put("tag", entry.getKey());
                        tagMap.put("count", entry.getValue());
                        return tagMap;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("posts", paginatedPosts);
            result.put("users", matchedUsers);
            result.put("tags", matchedTags);
            return result;
        } catch (Exception e) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("posts", Collections.emptyList());
            empty.put("users", Collections.emptyList());
            empty.put("tags", Collections.emptyList());
            return empty;
        }
    }

    public Map<String, Object> getUserAnalytics(Long userId) {
        if (userId == null) {
            return emptyUserAnalytics(null);
        }
        try {
            Page<PostDocument> userPostsPage = postSearchRepository.findByAuthorIdOrderByIsPinnedDescCreatedAtDesc(
                    userId, PageRequest.of(0, 500));
            List<PostDocument> posts = (userPostsPage != null && userPostsPage.getContent() != null)
                    ? userPostsPage.getContent()
                    : Collections.emptyList();

            long totalLikes = 0L;
            long totalComments = 0L;
            long totalReposts = 0L;
            Map<String, Long> tagCounts = new HashMap<>();
            PostDocument topPostDoc = null;
            double topEngagement = -1.0;

            for (PostDocument doc : posts) {
                if (doc == null) {
                    continue;
                }
                totalLikes += doc.getLikesCount();
                totalComments += doc.getCommentsCount();
                totalReposts += doc.getRepostsCount();

                double engagement = calculateInteractionScore(doc);
                if (topPostDoc == null || engagement > topEngagement) {
                    topEngagement = engagement;
                    topPostDoc = doc;
                }

                if (doc.getTags() != null) {
                    for (String tag : doc.getTags()) {
                        if (tag == null || tag.isBlank()) {
                            continue;
                        }
                        String cleanTag = tag.trim().toLowerCase();
                        tagCounts.put(cleanTag, tagCounts.getOrDefault(cleanTag, 0L) + 1L);
                    }
                }
            }

            List<Map<String, Object>> topTags = tagCounts.entrySet().stream()
                    .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                    .limit(5)
                    .map(entry -> {
                        Map<String, Object> tagMap = new LinkedHashMap<>();
                        tagMap.put("tag", entry.getKey());
                        tagMap.put("count", entry.getValue());
                        return tagMap;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> topPost = null;
            if (topPostDoc != null) {
                topPost = new LinkedHashMap<>();
                topPost.put("id", topPostDoc.getId());
                topPost.put("postId", topPostDoc.getPostId());
                topPost.put("content", topPostDoc.getContent());
                topPost.put("likesCount", topPostDoc.getLikesCount());
                topPost.put("commentsCount", topPostDoc.getCommentsCount());
                topPost.put("repostsCount", topPostDoc.getRepostsCount());
                topPost.put("engagementScore", topEngagement);
                topPost.put("createdAt", topPostDoc.getCreatedAt());
            }

            long followersCount = followerRelationRepository.countByFollowingId(userId);
            long followingCount = followerRelationRepository.countByFollowerId(userId);

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("userId", userId);
            result.put("totalPosts", posts.size());
            result.put("totalLikes", totalLikes);
            result.put("totalComments", totalComments);
            result.put("totalReposts", totalReposts);
            result.put("followersCount", followersCount);
            result.put("followingCount", followingCount);
            result.put("topTags", topTags);
            result.put("topPost", topPost);
            return result;
        } catch (Exception e) {
            return emptyUserAnalytics(userId);
        }
    }

    private double calculateInteractionScore(PostDocument doc) {
        return (doc.getLikesCount() * 2.0) + (doc.getCommentsCount() * 3.0) + (doc.getRepostsCount() * 4.0);
    }

    private Map<String, Object> emptyUserAnalytics(Long userId) {
        Map<String, Object> empty = new LinkedHashMap<>();
        empty.put("userId", userId);
        empty.put("totalPosts", 0);
        empty.put("totalLikes", 0L);
        empty.put("totalComments", 0L);
        empty.put("totalReposts", 0L);
        empty.put("followersCount", 0L);
        empty.put("followingCount", 0L);
        empty.put("topTags", Collections.emptyList());
        empty.put("topPost", null);
        return empty;
    }

    private boolean isVisible(PostDocument doc) {
        return doc != null && !doc.isHidden() && !"HIDDEN".equalsIgnoreCase(doc.getVisibility());
    }

    private Page<PostDocument> filterVisiblePage(Page<PostDocument> page, PageRequest pageRequest) {
        if (page == null || page.getContent() == null) {
            return new PageImpl<>(Collections.emptyList(), pageRequest, 0);
        }
        List<PostDocument> visible = page.getContent().stream()
                .filter(this::isVisible)
                .collect(Collectors.toList());
        if (visible.size() == page.getContent().size()) {
            return page;
        }
        return new PageImpl<>(visible, pageRequest, visible.size());
    }

    private void addCandidate(Map<String, PostDocument> candidateMap, PostDocument doc) {
        if (!isVisible(doc)) {
            return;
        }
        String key = doc.getPostId() != null
                ? "post-" + doc.getPostId()
                : (doc.getId() != null ? "id-" + doc.getId() : "obj-" + System.identityHashCode(doc));
        candidateMap.putIfAbsent(key, doc);
    }

    private boolean matchesPost(PostDocument doc, String lowerQuery) {
        if (doc.getContent() != null && doc.getContent().toLowerCase().contains(lowerQuery)) {
            return true;
        }
        if (doc.getAuthorUsername() != null && doc.getAuthorUsername().toLowerCase().contains(lowerQuery)) {
            return true;
        }
        if (doc.getTags() != null) {
            for (String tag : doc.getTags()) {
                if (tag != null && tag.toLowerCase().contains(lowerQuery)) {
                    return true;
                }
            }
        }
        return false;
    }
}