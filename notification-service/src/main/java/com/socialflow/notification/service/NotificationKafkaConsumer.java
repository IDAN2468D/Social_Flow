package com.socialflow.notification.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.notification.model.NotificationProcessedEvent;
import com.socialflow.notification.model.NotificationType;
import com.socialflow.notification.repository.NotificationProcessedEventRepository;
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

import java.time.LocalDateTime;

@Service
@Slf4j
public class NotificationKafkaConsumer {

    private final NotificationService notificationService;
    private final NotificationProcessedEventRepository processedEventRepository;
    private final ObjectMapper objectMapper;

    @Autowired
    public NotificationKafkaConsumer(
            NotificationService notificationService,
            NotificationProcessedEventRepository processedEventRepository,
            ObjectMapper objectMapper) {
        this.notificationService = notificationService;
        this.processedEventRepository = processedEventRepository;
        this.objectMapper = objectMapper;
    }

    public NotificationKafkaConsumer(NotificationService notificationService, ObjectMapper objectMapper) {
        this(notificationService, null, objectMapper);
    }

    @RetryableTopic(
            attempts = "3",
            backoff = @Backoff(delay = 1000, multiplier = 2.0),
            dltTopicSuffix = "-dlt",
            autoCreateTopics = "false",
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
            exclude = {IllegalArgumentException.class}
    )
    @KafkaListener(topics = {"post-events", "reaction-events"}, groupId = "notification-service-group")
    public void consumePostEvent(String message) {
        log.info("Notification service received post event: {}", message);
        JsonNode node = parseJson(message);
        String eventId = extractEventId(node);
        String eventType = node.hasNonNull("eventType") ? node.get("eventType").asText() : "";

        if (isAlreadyProcessed(eventId)) {
            log.debug("Skipping duplicate notification post event [eventId={}]", eventId);
            return;
        }

        // אירוע POST_LIKED
        if (node.hasNonNull("liked") && node.hasNonNull("postId") && node.hasNonNull("authorId")) {
            boolean liked = node.get("liked").asBoolean();
            if (!liked) {
                markProcessed(eventId, "reaction-events", "POST_UNLIKED");
                return;
            }

            Long postId = node.get("postId").asLong();
            Long actorId = node.get("userId").asLong();
            String username = node.hasNonNull("username") ? node.get("username").asText() : "משתמש";
            Long recipientId = node.get("authorId").asLong();

            String notificationMsg = "משתמש " + username + " סימן לייק לפוסט שלך";
            notificationService.createAndSendNotification(
                    recipientId,
                    actorId,
                    NotificationType.LIKE,
                    postId,
                    notificationMsg
            );
        }
        // אירוע COMMENT_CREATED
        else if (node.hasNonNull("commentId") && node.hasNonNull("postId") && node.hasNonNull("postAuthorId")) {
            Long postId = node.get("postId").asLong();
            Long actorId = node.get("authorId").asLong();
            String authorUsername = node.hasNonNull("authorUsername") ? node.get("authorUsername").asText() : "משתמש";
            Long recipientId = node.get("postAuthorId").asLong();

            String notificationMsg = "משתמש " + authorUsername + " הגיב לפוסט שלך";
            notificationService.createAndSendNotification(
                    recipientId,
                    actorId,
                    NotificationType.COMMENT,
                    postId,
                    notificationMsg
            );
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
    @KafkaListener(topics = "user-events", groupId = "notification-service-group")
    public void consumeUserEvent(String message) {
        log.info("Notification service received user event: {}", message);
        JsonNode node = parseJson(message);
        String eventId = extractEventId(node);
        String eventType = node.hasNonNull("eventType") ? node.get("eventType").asText() : "";

        if (isAlreadyProcessed(eventId)) {
            log.debug("Skipping duplicate notification user event [eventId={}]", eventId);
            return;
        }

        // אירוע USER_FOLLOWED
        if (node.hasNonNull("followerId") && node.hasNonNull("followingId")) {
            if (node.hasNonNull("isFollow") && !node.get("isFollow").asBoolean()) {
                log.info("Unfollow event detected for followerId {}, skipping notification", node.get("followerId").asLong());
                markProcessed(eventId, "user-events", "USER_UNFOLLOWED");
                return;
            }
            if (node.hasNonNull("follow") && !node.get("follow").asBoolean()) {
                markProcessed(eventId, "user-events", "USER_UNFOLLOWED");
                return;
            }

            Long actorId = node.get("followerId").asLong();
            String followerUsername = node.hasNonNull("followerUsername")
                    ? node.get("followerUsername").asText()
                    : "משתמש";
            Long recipientId = node.get("followingId").asLong();

            String notificationMsg = "משתמש " + followerUsername + " התחיל לעקוב אחריך";
            notificationService.createAndSendNotification(
                    recipientId,
                    actorId,
                    NotificationType.FOLLOW,
                    actorId,
                    notificationMsg
            );
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
    @KafkaListener(topics = "ai-enrichment-events", groupId = "notification-service-group")
    public void consumeAiEnrichmentEvent(String message) {
        log.info("Notification service received AI enrichment event: {}", message);
        JsonNode node = parseJson(message);
        String eventId = extractEventId(node);
        String eventType = node.hasNonNull("eventType") ? node.get("eventType").asText() : "";

        if (isAlreadyProcessed(eventId)) {
            log.debug("Skipping duplicate AI enrichment notification event [eventId={}]", eventId);
            return;
        }

        if ("CONTENT_FLAGGED".equalsIgnoreCase(eventType)) {
            String severity = node.hasNonNull("severity") ? node.get("severity").asText() : "";
            Long authorId = node.hasNonNull("authorId") ? node.get("authorId").asLong() : null;
            Long postId = node.hasNonNull("postId") ? node.get("postId").asLong() : null;
            if ("HIGH".equalsIgnoreCase(severity) && authorId != null && postId != null) {
                String msg = "הפוסט שלך #" + postId + " סומן והוסתר לבדיקת מודרציה אוטומטית";
                notificationService.createAndSendNotification(
                        authorId,
                        0L,
                        NotificationType.SYSTEM,
                        postId,
                        msg
                );
            }
        }

        markProcessed(eventId, "ai-enrichment-events", eventType.isEmpty() ? "AI_ENRICHMENT" : eventType);
    }

    @DltHandler
    public void handleDlt(
            String payload,
            @Header(name = KafkaHeaders.RECEIVED_TOPIC, required = false) String receivedTopic,
            @Header(name = KafkaHeaders.ORIGINAL_TOPIC, required = false) String originalTopic,
            @Header(name = KafkaHeaders.EXCEPTION_MESSAGE, required = false) String exceptionMessage) {
        log.error("Notification DLT message routed [originalTopic={}, dltTopic={}, error={}]: {}",
                originalTopic, receivedTopic, exceptionMessage, payload);
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
        if (node.hasNonNull("eventId") && !node.get("eventId").asText().isBlank()) {
            return node.get("eventId").asText().trim();
        }
        if (node.hasNonNull("event_id") && !node.get("event_id").asText().isBlank()) {
            return node.get("event_id").asText().trim();
        }
        return null;
    }

    private boolean isAlreadyProcessed(String eventId) {
        return eventId != null && processedEventRepository != null && processedEventRepository.existsById(eventId);
    }

    private void markProcessed(String eventId, String topic, String eventType) {
        if (eventId == null || processedEventRepository == null) {
            return;
        }
        try {
            processedEventRepository.save(NotificationProcessedEvent.builder()
                    .eventId(eventId)
                    .topic(topic)
                    .eventType(eventType)
                    .processedAt(LocalDateTime.now())
                    .build());
        } catch (DataIntegrityViolationException ignored) {
            log.debug("Event {} already recorded in notification_processed_events", eventId);
        }
    }
}