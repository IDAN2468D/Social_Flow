package com.socialflow.user.service;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.socialflow.user.event.UserFollowedEvent;
import com.socialflow.user.event.UserRegisteredEvent;
import com.socialflow.user.model.UserOutboxEvent;
import com.socialflow.user.repository.UserOutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
public class UserEventProducer {

    private static final Logger log = LoggerFactory.getLogger(UserEventProducer.class);
    public static final String TOPIC = "user-events";

    private final UserOutboxEventRepository outboxRepository;
    private final ObjectMapper objectMapper;

    public UserEventProducer(UserOutboxEventRepository outboxRepository) {
        this.outboxRepository = outboxRepository;
        this.objectMapper = new ObjectMapper()
                .registerModule(new JavaTimeModule())
                .setSerializationInclusion(JsonInclude.Include.NON_NULL);
    }

    @Transactional
    public void emitUserRegistered(UserRegisteredEvent event) {
        enqueueOutbox("USER", String.valueOf(event.getUserId()),
                "user-registered:" + event.getUserId(), "USER_REGISTERED", event);
    }

    @Transactional
    public void emitUserFollowed(UserFollowedEvent event) {
        String eventType = event.isFollow() ? "USER_FOLLOWED" : "USER_UNFOLLOWED";
        enqueueOutbox("USER", String.valueOf(event.getFollowerId()),
                "user-followed:" + event.getFollowerId(), eventType, event);
    }

    @Transactional
    public void emitUserProfileUpdated(Long userId, String username, String fullName, String bio) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", "USER_PROFILE_UPDATED");
        payload.put("userId", userId);
        payload.put("username", username);
        payload.put("fullName", fullName);
        payload.put("bio", bio);
        payload.put("timestamp", Instant.now().toString());
        enqueueOutbox("USER", String.valueOf(userId),
                "user-profile-updated:" + userId, "USER_PROFILE_UPDATED", payload);
    }

    private void enqueueOutbox(String aggregateType, String aggregateId, String partitionKey,
                               String eventType, Object payload) {
        try {
            String eventId = UUID.randomUUID().toString();
            JsonNode tree = objectMapper.valueToTree(payload);
            String jsonPayload;
            if (tree instanceof ObjectNode objectNode) {
                if (!objectNode.hasNonNull("eventId")) {
                    objectNode.put("eventId", eventId);
                } else {
                    eventId = objectNode.get("eventId").asText();
                }
                if (!objectNode.hasNonNull("eventType")) {
                    objectNode.put("eventType", eventType);
                }
                jsonPayload = objectMapper.writeValueAsString(objectNode);
            } else {
                jsonPayload = objectMapper.writeValueAsString(payload);
            }

            UserOutboxEvent outboxEvent = new UserOutboxEvent(
                    eventId, aggregateType, aggregateId, TOPIC, partitionKey, eventType, jsonPayload
            );
            outboxRepository.save(outboxEvent);
            log.debug("Enqueued {} [eventId={}] into user_outbox_events for topic '{}'", eventType, eventId, TOPIC);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize and persist user outbox event " + eventType, e);
        }
    }
}