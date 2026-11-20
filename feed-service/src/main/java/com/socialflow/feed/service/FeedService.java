package com.socialflow.feed.service;

import co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import co.elastic.clients.elasticsearch._types.query_dsl.Operator;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.feed.config.ElasticsearchIndexBootstrap;
import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.dto.CursorPageResponse;
import com.socialflow.feed.dto.TrendingTagDto;
import com.socialflow.feed.model.FollowerRelation;
import com.socialflow.feed.repository.FollowerRelationRepository;
import com.socialflow.feed.repository.PostElasticsearchRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchAggregation;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchAggregations;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.client.elc.NativeQueryBuilder;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class FeedService {

    private final PostElasticsearchRepository postSearchRepository;
    private final FollowerRelationRepository followerRelationRepository;
    private final ElasticsearchOperations elasticsearchOperations;
    private final ObjectMapper objectMapper;

    public FeedService(
            PostElasticsearchRepository postSearchRepository,
            FollowerRelationRepository followerRelationRepository) {
        this(postSearchRepository, followerRelationRepository, null, new ObjectMapper());
    }

    @Autowired
    public FeedService(
            PostElasticsearchRepository postSearchRepository,
            FollowerRelationRepository followerRelationRepository,
            @Autowired(required = false) ElasticsearchOperations elasticsearchOperations,
            @Autowired(required = false) ObjectMapper objectMapper) {
        this.postSearchRepository = postSearchRepository;
        this.followerRelationRepository = followerRelationRepository;
        this.elasticsearchOperations = elasticsearchOperations;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
    }

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

    public CursorPageResponse<PostDocument> getFeedCursor(String feedType, Long userId, String cursor, int size) {
        int safeSize = Math.max(1, Math.min(size, 50));
        String normalizedType = feedType != null ? feedType.trim().toLowerCase(Locale.ROOT) : "for-you";

        if (elasticsearchOperations != null) {
            try {
                BoolQuery.Builder bool = visiblePostBoolBuilder();
                Sort sort;
                if ("following".equals(normalizedType) && userId != null) {
                    List<Long> followingIds = followerRelationRepository.findByFollowerId(userId).stream()
                            .map(FollowerRelation::getFollowingId)
                            .collect(Collectors.toCollection(ArrayList::new));
                    followingIds.add(userId);
                    bool.filter(f -> f.terms(t -> t.field("authorId")
                            .terms(tv -> tv.value(followingIds.stream()
                                    .map(co.elastic.clients.elasticsearch._types.FieldValue::of)
                                    .collect(Collectors.toList())))));
                    sort = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("postId"));
                } else if ("trending".equals(normalizedType)) {
                    sort = Sort.by(Sort.Order.desc("likesCount"), Sort.Order.desc("createdAt"), Sort.Order.desc("postId"));
                } else {
                    sort = Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("postId"));
                }

                return executeCursorQuery(bool.build()._toQuery(), sort, cursor, safeSize);
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Exception e) {
                log.warn("Native ES cursor feed query failed, falling back to repository: {}", e.getMessage());
            }
        }

        // Fallback when ES operations is unavailable (e.g. unit tests)
        int offset = decodeOffsetFallbackCursor(cursor);
        int pageNum = offset / safeSize;
        Page<PostDocument> fallbackPage = switch (normalizedType) {
            case "following" -> userId != null ? getFollowingFeed(userId, pageNum, safeSize) : getForYouFeed(null, pageNum, safeSize);
            case "trending" -> getTrendingFeed(pageNum, safeSize);
            default -> getForYouFeed(userId, pageNum, safeSize);
        };
        List<PostDocument> items = fallbackPage != null && fallbackPage.getContent() != null
                ? fallbackPage.getContent()
                : Collections.emptyList();
        boolean hasMore = fallbackPage != null && fallbackPage.hasNext();
        String nextCursor = hasMore ? encodeOffsetFallbackCursor(offset + items.size()) : null;
        return CursorPageResponse.<PostDocument>builder()
                .items(items)
                .nextCursor(nextCursor)
                .hasMore(hasMore)
                .size(items.size())
                .build();
    }

    public Page<PostDocument> searchPostsFuzzy(String query, int page, int size) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 50));
        PageRequest pageRequest = PageRequest.of(safePage, safeSize, Sort.by("createdAt").descending());
        String clean = query != null ? query.trim() : "";

        if (elasticsearchOperations != null && !clean.isEmpty()) {
            try {
                Query esQuery = buildSearchQuery(clean, null, null, null, true);
                NativeQuery nativeQuery = NativeQuery.builder()
                        .withQuery(esQuery)
                        .withPageable(PageRequest.of(safePage, safeSize))
                        .build();
                SearchHits<PostDocument> hits = elasticsearchOperations.search(
                        nativeQuery, PostDocument.class, IndexCoordinates.of(ElasticsearchIndexBootstrap.POSTS_INDEX));
                List<PostDocument> docs = hits.getSearchHits().stream()
                        .map(SearchHit::getContent)
                        .filter(this::isVisible)
                        .collect(Collectors.toList());
                return new PageImpl<>(docs, pageRequest, hits.getTotalHits());
            } catch (Exception e) {
                log.warn("Native ES fuzzy search failed, falling back to repository: {}", e.getMessage());
            }
        }
        return searchPosts(clean, safePage, safeSize);
    }

    public CursorPageResponse<PostDocument> searchPostsCursor(
            String query, String tag, String author, String category, boolean fuzzy, String cursor, int size) {
        int safeSize = Math.max(1, Math.min(size, 50));
        if (elasticsearchOperations != null) {
            try {
                Query esQuery = buildSearchQuery(query, tag, author, category, fuzzy);
                Sort sort = (query != null && !query.isBlank())
                        ? Sort.by(Sort.Order.desc("_score"), Sort.Order.desc("createdAt"), Sort.Order.desc("postId"))
                        : Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("postId"));
                return executeCursorQuery(esQuery, sort, cursor, safeSize);
            } catch (IllegalArgumentException e) {
                throw e;
            } catch (Exception e) {
                log.warn("Native ES cursor search failed, falling back to repository: {}", e.getMessage());
            }
        }

        int offset = decodeOffsetFallbackCursor(cursor);
        int pageNum = offset / safeSize;
        Page<PostDocument> fallbackPage = (tag != null && !tag.isBlank())
                ? searchByTag(tag, pageNum, safeSize)
                : searchPosts(query, pageNum, safeSize);
        List<PostDocument> items = fallbackPage.getContent().stream()
                .filter(doc -> author == null || author.isBlank() || author.equalsIgnoreCase(doc.getAuthorUsername()))
                .filter(doc -> category == null || category.isBlank() || category.equalsIgnoreCase(doc.getAiCategory()))
                .collect(Collectors.toList());
        boolean hasMore = fallbackPage.hasNext();
        String nextCursor = hasMore ? encodeOffsetFallbackCursor(offset + items.size()) : null;
        return CursorPageResponse.<PostDocument>builder()
                .items(items)
                .nextCursor(nextCursor)
                .hasMore(hasMore)
                .size(items.size())
                .build();
    }

    public Map<String, Object> suggestSearch(String query, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 20));
        String clean = query != null ? query.trim() : "";
        String lower = clean.toLowerCase(Locale.ROOT);

        if (elasticsearchOperations != null && !clean.isEmpty()) {
            try {
                BoolQuery.Builder bool = visiblePostBoolBuilder();
                bool.must(m -> m.bool(inner -> inner
                        .should(s -> s.matchPhrasePrefix(mp -> mp.field("content").query(clean).boost(2.0f)))
                        .should(s -> s.prefix(p -> p.field("tags").value(lower)))
                        .should(s -> s.prefix(p -> p.field("aiTags").value(lower)))
                        .should(s -> s.prefix(p -> p.field("authorUsername").value(lower)))
                        .minimumShouldMatch("1")
                ));
                NativeQuery nativeQuery = NativeQuery.builder()
                        .withQuery(bool.build()._toQuery())
                        .withPageable(PageRequest.of(0, 25))
                        .build();
                SearchHits<PostDocument> hits = elasticsearchOperations.search(
                        nativeQuery, PostDocument.class, IndexCoordinates.of(ElasticsearchIndexBootstrap.POSTS_INDEX));
                List<PostDocument> docs = hits.getSearchHits().stream()
                        .map(SearchHit::getContent)
                        .filter(this::isVisible)
                        .collect(Collectors.toList());
                return buildSuggestionsPayload(clean, lower, docs, safeLimit);
            } catch (Exception e) {
                log.warn("Native ES suggest query failed, falling back to repository: {}", e.getMessage());
            }
        }

        List<PostDocument> recent = Collections.emptyList();
        try {
            Page<PostDocument> page = postSearchRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 50));
            if (page != null && page.getContent() != null) {
                recent = page.getContent().stream().filter(this::isVisible).collect(Collectors.toList());
            }
        } catch (Exception ignored) {
        }
        return buildSuggestionsPayload(clean, lower, recent, safeLimit);
    }

    public Map<String, Object> getSearchFacets(String query, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 50));
        String clean = query != null ? query.trim() : "";

        if (elasticsearchOperations != null) {
            try {
                Query esQuery = buildSearchQuery(clean, null, null, null, false);
                NativeQuery nativeQuery = NativeQuery.builder()
                        .withQuery(esQuery)
                        .withPageable(PageRequest.of(0, 0))
                        .withAggregation("top_tags", Aggregation.of(a -> a.terms(t -> t.field("tags").size(safeLimit))))
                        .withAggregation("top_ai_tags", Aggregation.of(a -> a.terms(t -> t.field("aiTags").size(safeLimit))))
                        .withAggregation("top_categories", Aggregation.of(a -> a.terms(t -> t.field("aiCategory").size(safeLimit))))
                        .withAggregation("top_sentiments", Aggregation.of(a -> a.terms(t -> t.field("sentiment").size(safeLimit))))
                        .build();

                SearchHits<PostDocument> hits = elasticsearchOperations.search(
                        nativeQuery, PostDocument.class, IndexCoordinates.of(ElasticsearchIndexBootstrap.POSTS_INDEX));

                Map<String, Object> result = new LinkedHashMap<>();
                result.put("totalMatchingPosts", hits.getTotalHits());
                if (hits.getAggregations() instanceof ElasticsearchAggregations aggs) {
                    result.put("tags", extractTermsBuckets(aggs.get("top_tags")));
                    result.put("aiTags", extractTermsBuckets(aggs.get("top_ai_tags")));
                    result.put("categories", extractTermsBuckets(aggs.get("top_categories")));
                    result.put("sentiments", extractTermsBuckets(aggs.get("top_sentiments")));
                    return result;
                }
            } catch (Exception e) {
                log.warn("Native ES facets aggregation failed, falling back to repository: {}", e.getMessage());
            }
        }

        return buildFallbackFacets(clean, safeLimit);
    }

    private CursorPageResponse<PostDocument> executeCursorQuery(Query query, Sort sort, String cursor, int safeSize) {
        NativeQueryBuilder builder = NativeQuery.builder()
                .withQuery(query)
                .withSort(sort)
                .withPageable(PageRequest.of(0, safeSize + 1));

        List<Object> searchAfter = decodeSearchAfter(cursor);
        if (searchAfter != null && !searchAfter.isEmpty()) {
            builder.withSearchAfter(searchAfter);
        }

        SearchHits<PostDocument> hits = elasticsearchOperations.search(
                builder.build(), PostDocument.class, IndexCoordinates.of(ElasticsearchIndexBootstrap.POSTS_INDEX));
        List<SearchHit<PostDocument>> hitList = hits.getSearchHits();

        boolean hasMore = hitList.size() > safeSize;
        List<SearchHit<PostDocument>> pageHits = hasMore ? hitList.subList(0, safeSize) : hitList;
        List<PostDocument> items = pageHits.stream().map(SearchHit::getContent).collect(Collectors.toList());

        String nextCursor = null;
        if (hasMore && !pageHits.isEmpty()) {
            List<Object> lastSortValues = pageHits.get(pageHits.size() - 1).getSortValues();
            nextCursor = encodeSearchAfter(lastSortValues);
        }

        return CursorPageResponse.<PostDocument>builder()
                .items(items)
                .nextCursor(nextCursor)
                .hasMore(hasMore)
                .size(items.size())
                .build();
    }

    private BoolQuery.Builder visiblePostBoolBuilder() {
        return new BoolQuery.Builder()
                .mustNot(mn -> mn.term(t -> t.field("hidden").value(true)))
                .mustNot(mn -> mn.term(t -> t.field("visibility").value("HIDDEN")));
    }

    private Query buildSearchQuery(String query, String tag, String author, String category, boolean fuzzy) {
        BoolQuery.Builder bool = visiblePostBoolBuilder();
        String clean = query != null ? query.trim() : "";
        if (!clean.isEmpty()) {
            bool.must(m -> m.multiMatch(mm -> {
                mm.query(clean)
                        .fields("content^2.0", "aiSummary^1.5", "tags^1.5", "aiTags^1.5", "authorUsername")
                        .operator(Operator.Or);
                if (fuzzy) {
                    mm.fuzziness("AUTO");
                }
                return mm;
            }));
        }
        if (tag != null && !tag.isBlank()) {
            String cleanTag = tag.trim().replaceFirst("^#", "").toLowerCase(Locale.ROOT);
            bool.filter(f -> f.bool(tb -> tb
                    .should(s -> s.term(t -> t.field("tags").value(cleanTag)))
                    .should(s -> s.term(t -> t.field("aiTags").value(cleanTag)))
                    .minimumShouldMatch("1")));
        }
        if (author != null && !author.isBlank()) {
            bool.filter(f -> f.term(t -> t.field("authorUsername").value(author.trim())));
        }
        if (category != null && !category.isBlank()) {
            bool.filter(f -> f.term(t -> t.field("aiCategory").value(category.trim())));
        }
        return bool.build()._toQuery();
    }

    private List<Map<String, Object>> extractTermsBuckets(ElasticsearchAggregation agg) {
        if (agg == null || agg.aggregation() == null) {
            return Collections.emptyList();
        }
        Aggregate aggregate = agg.aggregation().getAggregate();
        if (aggregate == null || !aggregate.isSterms()) {
            return Collections.emptyList();
        }
        List<Map<String, Object>> buckets = new ArrayList<>();
        for (StringTermsBucket b : aggregate.sterms().buckets().array()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("key", b.key().stringValue());
            item.put("count", b.docCount());
            buckets.add(item);
        }
        return buckets;
    }

    private Map<String, Object> buildSuggestionsPayload(String rawQuery, String lower, List<PostDocument> docs, int limit) {
        Set<String> tagSet = new LinkedHashSet<>();
        Set<String> userSet = new LinkedHashSet<>();
        List<Map<String, Object>> postSnippets = new ArrayList<>();

        for (PostDocument doc : docs) {
            if (doc.getTags() != null) {
                for (String t : doc.getTags()) {
                    if (t != null && (lower.isEmpty() || t.toLowerCase(Locale.ROOT).contains(lower))) {
                        tagSet.add(t.toLowerCase(Locale.ROOT));
                    }
                }
            }
            if (doc.getAiTags() != null) {
                for (String t : doc.getAiTags()) {
                    if (t != null && (lower.isEmpty() || t.toLowerCase(Locale.ROOT).contains(lower))) {
                        tagSet.add(t.toLowerCase(Locale.ROOT));
                    }
                }
            }
            if (doc.getAuthorUsername() != null && (lower.isEmpty()
                    || doc.getAuthorUsername().toLowerCase(Locale.ROOT).contains(lower))) {
                userSet.add(doc.getAuthorUsername());
            }
            if (postSnippets.size() < limit && doc.getContent() != null
                    && (lower.isEmpty() || doc.getContent().toLowerCase(Locale.ROOT).contains(lower))) {
                Map<String, Object> snippet = new LinkedHashMap<>();
                snippet.put("postId", doc.getPostId());
                snippet.put("authorUsername", doc.getAuthorUsername());
                snippet.put("content", doc.getContent().length() > 120
                        ? doc.getContent().substring(0, 120) + "..."
                        : doc.getContent());
                postSnippets.add(snippet);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("query", rawQuery);
        result.put("tags", tagSet.stream().limit(limit).collect(Collectors.toList()));
        result.put("users", userSet.stream().limit(limit).collect(Collectors.toList()));
        result.put("posts", postSnippets);
        return result;
    }

    private Map<String, Object> buildFallbackFacets(String query, int limit) {
        List<PostDocument> docs = Collections.emptyList();
        try {
            Page<PostDocument> page = (query != null && !query.isBlank())
                    ? postSearchRepository.findByContentContainingIgnoreCase(query, PageRequest.of(0, 150))
                    : postSearchRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(0, 150));
            if (page != null && page.getContent() != null) {
                docs = page.getContent().stream().filter(this::isVisible).collect(Collectors.toList());
            }
        } catch (Exception ignored) {
        }

        Map<String, Long> tagCounts = new HashMap<>();
        Map<String, Long> aiTagCounts = new HashMap<>();
        Map<String, Long> categoryCounts = new HashMap<>();
        Map<String, Long> sentimentCounts = new HashMap<>();

        for (PostDocument doc : docs) {
            if (doc.getTags() != null) {
                doc.getTags().forEach(t -> tagCounts.merge(t.toLowerCase(Locale.ROOT), 1L, Long::sum));
            }
            if (doc.getAiTags() != null) {
                doc.getAiTags().forEach(t -> aiTagCounts.merge(t.toLowerCase(Locale.ROOT), 1L, Long::sum));
            }
            if (doc.getAiCategory() != null && !doc.getAiCategory().isBlank()) {
                categoryCounts.merge(doc.getAiCategory(), 1L, Long::sum);
            }
            if (doc.getSentiment() != null && !doc.getSentiment().isBlank()) {
                sentimentCounts.merge(doc.getSentiment(), 1L, Long::sum);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("totalMatchingPosts", (long) docs.size());
        result.put("tags", topFacetBuckets(tagCounts, limit));
        result.put("aiTags", topFacetBuckets(aiTagCounts, limit));
        result.put("categories", topFacetBuckets(categoryCounts, limit));
        result.put("sentiments", topFacetBuckets(sentimentCounts, limit));
        return result;
    }

    private List<Map<String, Object>> topFacetBuckets(Map<String, Long> counts, int limit) {
        return counts.entrySet().stream()
                .sorted((a, b) -> Long.compare(b.getValue(), a.getValue()))
                .limit(limit)
                .map(e -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("key", e.getKey());
                    item.put("count", e.getValue());
                    return item;
                })
                .collect(Collectors.toList());
    }

    private String encodeSearchAfter(List<Object> sortValues) {
        if (sortValues == null || sortValues.isEmpty()) {
            return null;
        }
        try {
            byte[] json = objectMapper.writeValueAsBytes(sortValues);
            return Base64.getUrlEncoder().withoutPadding().encodeToString(json);
        } catch (Exception e) {
            return null;
        }
    }

    private List<Object> decodeSearchAfter(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return null;
        }
        try {
            byte[] decoded = Base64.getUrlDecoder().decode(cursor.trim());
            return objectMapper.readValue(decoded, new TypeReference<>() {});
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid pagination cursor");
        }
    }

    private int decodeOffsetFallbackCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0;
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(cursor.trim()), StandardCharsets.UTF_8);
            if (raw.startsWith("offset:")) {
                return Math.max(0, Integer.parseInt(raw.substring(7)));
            }
        } catch (Exception ignored) {
        }
        return 0;
    }

    private String encodeOffsetFallbackCursor(int offset) {
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(("offset:" + offset).getBytes(StandardCharsets.UTF_8));
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