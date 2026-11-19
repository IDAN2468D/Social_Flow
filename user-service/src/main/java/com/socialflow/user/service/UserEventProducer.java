package com.socialflow.user.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.socialflow.user.event.UserFollowedEvent;
import com.socialflow.user.event.UserRegisteredEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
public class UserEventProducer {

    private static final Logger log = LoggerFactory.getLogger(UserEventProducer.class);
    private static final String TOPIC = "user-events";

    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public UserEventProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .setSerializationInclusion(JsonInclude.Include.NON_NULL);
    }

    public void emitUserRegistered(UserRegisteredEvent event) {
        try {
            String jsonPayload = objectMapper.writeValueAsString(event);
            log.info("משדר אירוע רישום משתמש ל-Kafka [{}]: {}", TOPIC, jsonPayload);
            kafkaTemplate.send(TOPIC, "user-registered:" + event.getUserId(), jsonPayload);
        } catch (Exception e) {
            log.error("שגיאה בשידור אירוע רישום ל-Kafka: {}", e.getMessage());
        }
    }

    public void emitUserFollowed(UserFollowedEvent event) {
        try {
            String jsonPayload = objectMapper.writeValueAsString(event);
            log.info("משדר אירוע מעקב ל-Kafka [{}]: {}", TOPIC, jsonPayload);
            kafkaTemplate.send(TOPIC, "user-followed:" + event.getFollowerId(), jsonPayload);
        } catch (Exception e) {
            log.error("שגיאה בשידור אירוע מעקב ל-Kafka: {}", e.getMessage());
        }
    }

    public void emitUserProfileUpdated(Long userId, String username, String fullName, String bio) {
        try {
            java.util.Map<String, Object> payload = new java.util.LinkedHashMap<>();
            payload.put("eventType", "USER_PROFILE_UPDATED");
            payload.put("userId", userId);
            payload.put("username", username);
            payload.put("fullName", fullName);
            payload.put("bio", bio);
            payload.put("timestamp", java.time.Instant.now().toString());
            String jsonPayload = objectMapper.writeValueAsString(payload);
            log.info("משדר אירוע עדכון פרופיל ל-Kafka [{}]: {}", TOPIC, jsonPayload);
            kafkaTemplate.send(TOPIC, "user-profile-updated:" + userId, jsonPayload);
        } catch (Exception e) {
            log.error("שגיאה בשידור אירוע עדכון פרופיל ל-Kafka: {}", e.getMessage());
        }
    }
}