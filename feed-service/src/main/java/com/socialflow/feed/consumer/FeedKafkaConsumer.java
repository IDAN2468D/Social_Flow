package com.socialflow.feed.consumer;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.model.FeedProcessedEvent;
import com.socialflow.feed.model.FollowerRelation;
import com.socialflow.feed.repository.FeedProcessedEventRepository;
import com.socialflow.feed.repository.FollowerRelationRepository;
import com.socialflow.feed.repository.PostElasticsearchRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.kafka.support.KafkaHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.retry.annotation.Backoff;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@Slf4j
public class FeedKafkaConsumer {

    private final PostElasticsearchRepository postSearchRepository;
    private final FollowerRelationRepository followerRelationRepository;
    private final FeedProcessedEventRepository processedEventRepository;
    private final ObjectMapper objectMapper;

    @Autowired
    public FeedKafkaConsumer(
            PostElasticsearchRepository postSearchRepository,
            FollowerRelationRepository followerRelationRepository,
            FeedProcessedEventRepository processedEventRepository,
            ObjectMapper objectMapper) {
        this.postSearchRepository = postSearchRepository;
        this.followerRelationRepository = followerRelationRepository;
        this.processedEventRepository = processedEventRepository;
        this.objectMapper = objectMapper;
    }

    public FeedKafkaConsumer(
            PostElasticsearchRepository postSearchRepository,
            FollowerRelationRepository followerRelationRepository,
            ObjectMapper objectMapper) {
        this(postSearchRepository, followerRelationRepository, null, objectMapper);
    }

    @RetryableTopic(
            attempts = "3",
            backoff = @Backoff(delay = 1000, multiplier = 2.0),
            dltTopicSuffix = "-dlt",
            autoCreateTopics = "false",
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
            exclude = {IllegalArgumentException.class}
    )
    @KafkaListener(topics = {"post-events", "reaction-events"}, groupId = "feed-service-group")
    public void consumePostEvent(String message) {
        log.info("Received post event: {}", message);
        JsonNode node = parseJson(message);
        String eventId = extractEventId(node);
        String eventType = textOrEmpty(node, "eventType");

        if (isAlreadyProcessed(eventId)) {
            log.debug("Skipping duplicate post/reaction event [eventId={}]", eventId);
            return;
        }

        if ("COMMENT_CREATED".equals(eventType) || node.has("commentId")) {
            if (node.hasNonNull("postId")) {
                Long postId = node.get("postId").asLong();
                postSearchRepository.findByPostId(postId).ifPresent(doc -> {
                    doc.setCommentsCount(doc.getCommentsCount() + 1);
                    postSearchRepository.save(doc);
                });
            }
        } else if ("POST_REINDEX".equals(eventType)) {
            upsertPostDocument(node, true);
        } else if ("POST_CREATED".equals(eventType)
                || (eventType.isEmpty() && node.has("postId") && node.has("content") && !node.has("commentId"))) {
            upsertPostDocument(node, false);
        } else if ("POST_LIKED".equals(eventType) || (node.has("postId") && node.has("liked"))) {
            if (node.hasNonNull("postId") && node.hasNonNull("liked")) {
                Long postId = node.get("postId").asLong();
                boolean liked = node.get("liked").asBoolean();
                postSearchRepository.findByPostId(postId).ifPresent(doc -> {
                    int updatedLikes = liked ? doc.getLikesCount() + 1 : Math.max(0, doc.getLikesCount() - 1);
                    doc.setLikesCount(updatedLikes);
                    postSearchRepository.save(doc);
                });
            }
        } else if ("POST_REPOSTED".equals(eventType) || (node.has("repostId") && node.has("originalPostId"))) {
            if (node.hasNonNull("originalPostId")) {
                Long originalPostId = node.get("originalPostId").asLong();
                postSearchRepository.findByPostId(originalPostId).ifPresent(doc -> {
                    doc.setRepostsCount(doc.getRepostsCount() + 1);
                    postSearchRepository.save(doc);
                });
            }
        } else if ("POST_PINNED".equals(eventType) || (node.has("pinned") && !node.has("content"))) {
            if (node.hasNonNull("postId") && node.hasNonNull("pinned")) {
                Long postId = node.get("postId").asLong();
                boolean pinned = node.get("pinned").asBoolean();
                postSearchRepository.findByPostId(postId).ifPresent(doc -> {
                    doc.setPinned(pinned);
                    postSearchRepository.save(doc);
                });
            }
        } else if ("POST_DELETED".equals(eventType)
                || (eventType.isEmpty() && node.has("postId") && !node.has("content"))) {
            Long postId = node.get("postId").asLong();
            postSearchRepository.findByPostId(postId).ifPresent(postSearchRepository::delete);
        }

        markProcessed(eventId, "post-events", eventType.isEmpty() ? "POST_EVENT" : eventType);
    }

    @RetryableTopic(
            attempts = "3",
            backoff = @Backoff(delay = 1000, multiplier = 2.0),
            dltTopicSuffix = "-dlt",
            autoCreateTopics = "false",
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
            exclude = {IllegalArgumentException.class}
    )
    @KafkaListener(topics = "user-events", groupId = "feed-service-group")
    @Transactional
    public void consumeUserEvent(String message) {
        log.info("Received user event: {}", message);
        JsonNode node = parseJson(message);
        String eventId = extractEventId(node);
        String eventType = textOrEmpty(node, "eventType");

        if (isAlreadyProcessed(eventId)) {
            log.debug("Skipping duplicate user event [eventId={}]", eventId);
            return;
        }

        if (node.hasNonNull("followerId") && node.hasNonNull("followingId")) {
            Long followerId = node.get("followerId").asLong();
            Long followingId = node.get("followingId").asLong();
            boolean isFollow = !node.hasNonNull("follow") && !node.hasNonNull("isFollow")
                    ? true
                    : (node.hasNonNull("follow") ? node.get("follow").asBoolean() : node.get("isFollow").asBoolean());

            if (!isFollow) {
                followerRelationRepository.deleteByFollowerIdAndFollowingId(followerId, followingId);
            } else if (!followerRelationRepository.existsByFollowerIdAndFollowingId(followerId, followingId)) {
                followerRelationRepository.save(FollowerRelation.builder()
                        .followerId(followerId)
                        .followingId(followingId)
                        .build());
            }
        }

        markProcessed(eventId, "user-events", eventType.isEmpty() ? "USER_EVENT" : eventType);
    }

    @RetryableTopic(
            attempts = "3",
            backoff = @Backoff(delay = 1000, multiplier = 2.0),
            dltTopicSuffix = "-dlt",
            autoCreateTopics = "false",
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
            exclude = {IllegalArgumentException.class}
    )
    @KafkaListener(topics = "ai-enrichment-events", groupId = "feed-service-group")
    public void consumeAiEnrichmentEvent(String message) {
        log.info("Received AI enrichment event: {}", message);
        JsonNode node = parseJson(message);
        String eventId = extractEventId(node);
        String eventType = textOrEmpty(node, "eventType");

        if (isAlreadyProcessed(eventId)) {
            log.debug("Skipping duplicate AI enrichment event [eventId={}]", eventId);
            return;
        }

        Long postId = extractLongField(node, "postId", "post_id");
        if (postId == null) {
            throw new IllegalArgumentException("AI enrichment event missing required postId");
        }

        PostDocument doc = postSearchRepository.findByPostId(postId)
                .orElseThrow(() -> new IllegalStateException("PostDocument not yet indexed in Elasticsearch for postId=" + postId));

        if ("POST_ENRICHED".equalsIgnoreCase(eventType) || "AI_ENRICHMENT_CREATED".equalsIgnoreCase(eventType)) {
            mergeAiEnrichmentFields(doc, node);
            boolean isSafe = !node.hasNonNull("isSafe") || node.get("isSafe").asBoolean();
            if (isSafe && (doc.getModerationStatus() == null || doc.getModerationStatus().isBlank())) {
                doc.setModerationStatus("APPROVED");
            }
            postSearchRepository.save(doc);
            log.info("Enriched PostDocument {} with AI metadata (sentiment={}, aiTags={})",
                    postId, doc.getSentiment(), doc.getAiTags());
        } else if ("CONTENT_FLAGGED".equalsIgnoreCase(eventType)) {
            mergeAiEnrichmentFields(doc, node);
            String severity = firstNonBlank(node, "severity");
            String reason = firstNonBlank(node, "moderationReason", "moderation_reason", "reason", "summary");
            if (reason != null) {
                doc.setModerationReason(reason);
            }
            if ("HIGH".equalsIgnoreCase(severity)) {
                doc.setModerationStatus("HIDDEN");
                doc.setHidden(true);
                doc.setVisibility("HIDDEN");
                log.warn("PostDocument {} auto-hidden due to HIGH severity CONTENT_FLAGGED event", postId);
            } else {
                doc.setModerationStatus("FLAGGED");
                log.info("PostDocument {} marked FLAGGED (severity={})", postId, severity);
            }
            postSearchRepository.save(doc);
        }

        markProcessed(eventId, "ai-enrichment-events", eventType.isEmpty() ? "AI_ENRICHMENT" : eventType);
    }

    @DltHandler
    public void handleDlt(
            String payload,
            @Header(name = KafkaHeaders.RECEIVED_TOPIC, required = false) String receivedTopic,
            @Header(name = KafkaHeaders.ORIGINAL_TOPIC, required = false) String originalTopic,
            @Header(name = KafkaHeaders.EXCEPTION_MESSAGE, required = false) String exceptionMessage) {
        log.error("DLT message routed [originalTopic={}, dltTopic={}, error={}]: {}",
                originalTopic, receivedTopic, exceptionMessage, payload);
    }

    private void upsertPostDocument(JsonNode node, boolean isReindex) {
        if (!node.hasNonNull("postId")) {
            throw new IllegalArgumentException("Post event missing required postId");
        }
        Long postId = node.get("postId").asLong();
        Long authorId = node.hasNonNull("authorId") ? node.get("authorId").asLong() : null;
        String authorUsername = textOrEmpty(node, "authorUsername");
        String authorAvatar = node.hasNonNull("authorAvatar") ? node.get("authorAvatar").asText() : null;
        String content = textOrEmpty(node, "content");

        List<String> tags = extractStringList(node, "tags");
        List<String> mediaUrls = extractStringList(node, "mediaUrls");
        Set<String> mentions = new HashSet<>(extractStringList(node, "mentions"));

        boolean hasPoll = node.hasNonNull("hasPoll") && node.get("hasPoll").asBoolean();
        boolean isRepost = node.hasNonNull("isRepost") && node.get("isRepost").asBoolean();
        Long originalPostId = node.hasNonNull("originalPostId") ? node.get("originalPostId").asLong() : null;
        String visibility = node.hasNonNull("visibility") ? node.get("visibility").asText() : "PUBLIC";

        LocalDateTime createdAt = LocalDateTime.now();
        if (node.hasNonNull("createdAt")) {
            try {
                createdAt = LocalDateTime.parse(node.get("createdAt").asText());
            } catch (Exception e) {
                log.warn("Could not parse createdAt from event: {}, falling back to now()", node.get("createdAt").asText());
            }
        }

        PostDocument.PostDocumentBuilder builder = PostDocument.builder()
                .id(postId.toString())
                .postId(postId)
                .authorId(authorId)
                .authorUsername(authorUsername)
                .authorAvatar(authorAvatar)
                .content(content)
                .mediaUrls(mediaUrls)
                .tags(tags)
                .mentions(mentions)
                .likesCount(isReindex && node.hasNonNull("likesCount") ? node.get("likesCount").asInt() : 0)
                .commentsCount(isReindex && node.hasNonNull("commentsCount") ? node.get("commentsCount").asInt() : 0)
                .repostsCount(isReindex && node.hasNonNull("repostsCount") ? node.get("repostsCount").asInt() : 0)
                .hasPoll(hasPoll)
                .isRepost(isRepost)
                .originalPostId(originalPostId)
                .isPinned(isReindex && node.hasNonNull("isPinned") && node.get("isPinned").asBoolean())
                .visibility(visibility)
                .createdAt(createdAt);

        if (isReindex) {
            Optional<PostDocument> existingOpt = postSearchRepository.findByPostId(postId);
            if (existingOpt.isPresent()) {
                PostDocument existing = existingOpt.get();
                builder.aiTags(existing.getAiTags())
                        .sentiment(existing.getSentiment())
                        .aiSummary(existing.getAiSummary())
                        .aiCategory(existing.getAiCategory())
                        .moderationStatus(existing.getModerationStatus())
                        .moderationReason(existing.getModerationReason())
                        .hidden(existing.isHidden());
                if (existing.isHidden()) {
                    builder.visibility("HIDDEN");
                }
            }
        }

        postSearchRepository.save(builder.build());
        log.info("{} post {} into Elasticsearch", isReindex ? "Reindexed" : "Indexed", postId);
    }

    private void mergeAiEnrichmentFields(PostDocument doc, JsonNode node) {
        List<String> incomingAiTags = extractStringList(node, "aiTags");
        if (incomingAiTags.isEmpty()) {
            incomingAiTags = extractStringList(node, "suggestedTags");
        }
        if (incomingAiTags.isEmpty()) {
            incomingAiTags = extractStringList(node, "suggested_tags");
        }
        if (!incomingAiTags.isEmpty()) {
            Set<String> merged = new LinkedHashSet<>();
            if (doc.getAiTags() != null) {
                merged.addAll(doc.getAiTags());
            }
            for (String tag : incomingAiTags) {
                if (tag != null && !tag.isBlank()) {
                    merged.add(tag.trim().replaceFirst("^#", "").toLowerCase());
                }
            }
            doc.setAiTags(new ArrayList<>(merged));
        }

        String sentiment = firstNonBlank(node, "sentiment");
        if (sentiment != null) {
            doc.setSentiment(sentiment);
        }

        String summary = firstNonBlank(node, "summary", "aiSummary", "ai_summary");
        if (summary != null) {
            doc.setAiSummary(summary);
        }

        String category = firstNonBlank(node, "category", "aiCategory", "ai_category");
        if (category != null) {
            doc.setAiCategory(category);
        }
    }

    private JsonNode parseJson(String message) {
        if (message == null || message.isBlank()) {
            throw new IllegalArgumentException("Kafka message payload is empty");
        }
        try {
            return objectMapper.readTree(message);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Malformed Kafka JSON payload: " + e.getOriginalMessage(), e);
        }
    }

    private String extractEventId(JsonNode node) {
        return firstNonBlank(node, "eventId", "event_id");
    }

    private boolean isAlreadyProcessed(String eventId) {
        return eventId != null && processedEventRepository != null && processedEventRepository.existsById(eventId);
    }

    private void markProcessed(String eventId, String topic, String eventType) {
        if (eventId == null || processedEventRepository == null) {
            return;
        }
        try {
            processedEventRepository.save(FeedProcessedEvent.builder()
                    .eventId(eventId)
                    .topic(topic)
                    .eventType(eventType)
                    .processedAt(LocalDateTime.now())
                    .build());
        } catch (DataIntegrityViolationException ignored) {
            log.debug("Event {} already recorded in feed_processed_events", eventId);
        }
    }

    private String textOrEmpty(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.get(field).asText() : "";
    }

    private String firstNonBlank(JsonNode node, String... fields) {
        for (String field : fields) {
            if (node.hasNonNull(field)) {
                String value = node.get(field).asText();
                if (value != null && !value.isBlank()) {
                    return value.trim();
                }
            }
        }
        return null;
    }

    private Long extractLongField(JsonNode node, String... fields) {
        for (String field : fields) {
            if (node.hasNonNull(field)) {
                JsonNode val = node.get(field);
                if (val.isNumber()) {
                    return val.asLong();
                }
                if (val.isTextual() && !val.asText().isBlank()) {
                    try {
                        return Long.parseLong(val.asText().trim());
                    } catch (NumberFormatException ignored) {
                        return null;
                    }
                }
            }
        }
        return null;
    }

    private List<String> extractStringList(JsonNode node, String field) {
        List<String> list = new ArrayList<>();
        if (node.has(field) && node.get(field).isArray()) {
            node.get(field).forEach(item -> {
                if (item != null && !item.isNull()) {
                    list.add(item.asText());
                }
            });
        }
        return list;
    }
}