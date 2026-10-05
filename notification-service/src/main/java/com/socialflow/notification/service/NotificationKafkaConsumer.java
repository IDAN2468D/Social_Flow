package com.socialflow.notification.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.notification.model.NotificationType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationKafkaConsumer {

    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "post-events", groupId = "notification-service-group")
    public void consumePostEvent(String message) {
        log.info("Notification service received post event: {}", message);
        try {
            JsonNode node = objectMapper.readTree(message);

            // אירוע POST_LIKED
            if (node.has("liked") && node.has("postId") && node.has("authorId")) {
                boolean liked = node.get("liked").asBoolean();
                if (!liked) {
                    return;
                }

                Long postId = node.get("postId").asLong();
                Long actorId = node.get("userId").asLong();
                String username = node.has("username") ? node.get("username").asText() : "משתמש";
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
            else if (node.has("commentId") && node.has("postId") && node.has("postAuthorId")) {
                Long postId = node.get("postId").asLong();
                Long actorId = node.get("authorId").asLong();
                String authorUsername = node.has("authorUsername") ? node.get("authorUsername").asText() : "משתמש";
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
        } catch (Exception e) {
            log.error("Failed to process post event for notifications: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "user-events", groupId = "notification-service-group")
    public void consumeUserEvent(String message) {
        log.info("Notification service received user event: {}", message);
        try {
            JsonNode node = objectMapper.readTree(message);

            // אירוע USER_FOLLOWED
            if (node.has("followerId") && node.has("followingId")) {
                // בדיקה אם מדובר בביטול מעקב (unfollow)
                if (node.has("isFollow") && !node.get("isFollow").asBoolean()) {
                    log.info("Unfollow event detected for followerId {}, skipping notification", node.get("followerId").asLong());
                    return;
                }
                if (node.has("follow") && !node.get("follow").asBoolean()) {
                    return;
                }

                Long actorId = node.get("followerId").asLong();
                String followerUsername = (node.has("followerUsername") && !node.get("followerUsername").isNull())
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
        } catch (Exception e) {
            log.error("Failed to process user event for notifications: {}", e.getMessage(), e);
        }
    }
}