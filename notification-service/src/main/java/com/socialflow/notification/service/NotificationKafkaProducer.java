package com.socialflow.notification.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.notification.dto.NotificationResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationKafkaProducer {

    private static final String NOTIFICATION_EVENTS_TOPIC = "notification-events";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public void emitNotificationCreated(NotificationResponseDto dto) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", "NOTIFICATION_CREATED");
        payload.put("notificationId", dto.getId());
        payload.put("recipientId", dto.getRecipientId());
        payload.put("actorId", dto.getActorId());
        payload.put("type", dto.getType() != null ? dto.getType().name() : "SYSTEM");
        payload.put("entityId", dto.getEntityId());
        payload.put("message", dto.getMessage());
        payload.put("isRead", dto.getIsRead());
        payload.put("timestamp", Instant.now().toString());
        send("user:" + dto.getRecipientId(), payload);
    }

    public void emitNotificationRead(NotificationResponseDto dto) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", "NOTIFICATION_READ");
        payload.put("notificationId", dto.getId());
        payload.put("recipientId", dto.getRecipientId());
        payload.put("timestamp", Instant.now().toString());
        send("user:" + dto.getRecipientId(), payload);
    }

    public void emitAllNotificationsRead(Long recipientId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", "NOTIFICATIONS_ALL_READ");
        payload.put("recipientId", recipientId);
        payload.put("timestamp", Instant.now().toString());
        send("user:" + recipientId, payload);
    }

    private void send(String key, Map<String, Object> payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send(NOTIFICATION_EVENTS_TOPIC, key, json);
            log.info("Emitted {} to topic '{}': {}", payload.get("eventType"), NOTIFICATION_EVENTS_TOPIC, json);
        } catch (Exception e) {
            log.error("Failed to emit notification event to Kafka topic '{}': {}", NOTIFICATION_EVENTS_TOPIC, e.getMessage(), e);
        }
    }
}
