package com.socialflow.post.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.socialflow.post.event.CommentCreatedEvent;
import com.socialflow.post.event.PostCreatedEvent;
import com.socialflow.post.event.PostDeletedEvent;
import com.socialflow.post.event.PostLikedEvent;
import com.socialflow.post.event.PostPinnedEvent;
import com.socialflow.post.event.PostRepostedEvent;
import com.socialflow.post.event.ReactionEvent;
import com.socialflow.post.model.Post;
import com.socialflow.post.model.PostOutboxEvent;
import com.socialflow.post.repository.PostOutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class PostKafkaProducer {

    private final PostOutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;

    public static final String POST_EVENTS_TOPIC = "post-events";
    public static final String REACTION_EVENTS_TOPIC = "reaction-events";
    public static final String MODERATION_EVENTS_TOPIC = "moderation-events";

    @Transactional
    public void emitPostCreated(PostCreatedEvent event) {
        enqueueOutbox(POST_EVENTS_TOPIC, "POST", String.valueOf(event.getPostId()), "POST_CREATED",
                String.valueOf(event.getPostId()), event);
    }

    @Transactional
    public void emitPostLiked(PostLikedEvent event) {
        enqueueOutbox(REACTION_EVENTS_TOPIC, "POST", String.valueOf(event.getPostId()), "POST_LIKED",
                String.valueOf(event.getPostId()), event);
    }

    @Transactional
    public void emitReactionEvent(ReactionEvent event) {
        enqueueOutbox(REACTION_EVENTS_TOPIC, "POST", String.valueOf(event.getPostId()), "POST_REACTION",
                String.valueOf(event.getPostId()), event);
    }

    @Transactional
    public void emitCommentCreated(CommentCreatedEvent event) {
        enqueueOutbox(POST_EVENTS_TOPIC, "POST", String.valueOf(event.getPostId()), "COMMENT_CREATED",
                String.valueOf(event.getPostId()), event);
    }

    @Transactional
    public void emitPostReposted(PostRepostedEvent event) {
        enqueueOutbox(POST_EVENTS_TOPIC, "POST", String.valueOf(event.getRepostId()), "POST_REPOSTED",
                String.valueOf(event.getRepostId()), event);
    }

    @Transactional
    public void emitPostDeleted(PostDeletedEvent event) {
        enqueueOutbox(POST_EVENTS_TOPIC, "POST", String.valueOf(event.getPostId()), "POST_DELETED",
                String.valueOf(event.getPostId()), event);
    }

    @Transactional
    public void emitPostPinned(PostPinnedEvent event) {
        enqueueOutbox(POST_EVENTS_TOPIC, "POST", String.valueOf(event.getPostId()), "POST_PINNED",
                String.valueOf(event.getPostId()), event);
    }

    @Transactional
    public void emitModerationEvent(String eventType, Long postId, Map<String, Object> details) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", eventType);
        payload.put("postId", postId);
        if (details != null) {
            payload.putAll(details);
        }
        enqueueOutbox(MODERATION_EVENTS_TOPIC, "POST", String.valueOf(postId), eventType,
                String.valueOf(postId), payload);
    }

    @Transactional
    public void emitPostReindexSnapshot(Post post) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("eventType", "POST_REINDEX");
        snapshot.put("postId", post.getId());
        snapshot.put("authorId", post.getAuthorId());
        snapshot.put("authorUsername", post.getAuthorUsername());
        snapshot.put("authorAvatar", post.getAuthorAvatar());
        snapshot.put("content", post.getContent());
        snapshot.put("mediaUrls", post.getMediaUrls());
        snapshot.put("tags", post.getTags());
        snapshot.put("mentions", post.getMentions());
        snapshot.put("likesCount", post.getLikesCount());
        snapshot.put("commentsCount", post.getCommentsCount());
        snapshot.put("repostsCount", post.getRepostsCount());
        snapshot.put("hasPoll", post.getPoll() != null);
        snapshot.put("isRepost", post.isRepost());
        snapshot.put("originalPostId", post.getOriginalPostId());
        snapshot.put("isPinned", post.isPinned());
        snapshot.put("visibility", post.getVisibility());
        snapshot.put("createdAt", post.getCreatedAt());

        enqueueOutbox(POST_EVENTS_TOPIC, "POST", String.valueOf(post.getId()), "POST_REINDEX",
                String.valueOf(post.getId()), snapshot);
    }

    private void enqueueOutbox(String topic, String aggregateType, String aggregateId,
                               String eventType, String partitionKey, Object payload) {
        try {
            String eventId = UUID.randomUUID().toString();
            JsonNode tree = objectMapper.valueToTree(payload);
            String json;
            if (tree instanceof ObjectNode objectNode) {
                if (!objectNode.hasNonNull("eventId")) {
                    objectNode.put("eventId", eventId);
                } else {
                    eventId = objectNode.get("eventId").asText();
                }
                if (!objectNode.hasNonNull("eventType")) {
                    objectNode.put("eventType", eventType);
                }
                json = objectMapper.writeValueAsString(objectNode);
            } else {
                json = objectMapper.writeValueAsString(payload);
            }

            PostOutboxEvent outboxEvent = PostOutboxEvent.builder()
                    .eventId(eventId)
                    .aggregateType(aggregateType)
                    .aggregateId(aggregateId)
                    .topic(topic)
                    .partitionKey(partitionKey)
                    .eventType(eventType)
                    .payload(json)
                    .status(PostOutboxEvent.OutboxStatus.PENDING)
                    .retryCount(0)
                    .createdAt(LocalDateTime.now())
                    .build();

            outboxRepository.save(outboxEvent);
            log.debug("Enqueued {} [eventId={}] into post_outbox_events for topic '{}'", eventType, eventId, topic);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize and persist outbox event " + eventType, e);
        }
    }
}