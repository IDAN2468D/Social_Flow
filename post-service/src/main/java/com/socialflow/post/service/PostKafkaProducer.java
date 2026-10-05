package com.socialflow.post.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.post.event.CommentCreatedEvent;
import com.socialflow.post.event.PostCreatedEvent;
import com.socialflow.post.event.PostDeletedEvent;
import com.socialflow.post.event.PostLikedEvent;
import com.socialflow.post.event.PostRepostedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class PostKafkaProducer {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    private static final String POST_EVENTS_TOPIC = "post-events";

    public void emitPostCreated(PostCreatedEvent event) {
        sendEvent("POST_CREATED", event.getPostId().toString(), event);
    }

    public void emitPostLiked(PostLikedEvent event) {
        sendEvent("POST_LIKED", event.getPostId().toString(), event);
    }

    public void emitCommentCreated(CommentCreatedEvent event) {
        sendEvent("COMMENT_CREATED", event.getPostId().toString(), event);
    }

    public void emitPostReposted(PostRepostedEvent event) {
        sendEvent("POST_REPOSTED", event.getRepostId().toString(), event);
    }

    public void emitPostDeleted(PostDeletedEvent event) {
        sendEvent("POST_DELETED", event.getPostId().toString(), event);
    }

    private void sendEvent(String eventType, String key, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send(POST_EVENTS_TOPIC, key, json);
            log.info("Emitted {} to topic '{}'", eventType, POST_EVENTS_TOPIC);
        } catch (Exception e) {
            log.error("Failed to emit {} event to Kafka: {}", eventType, e.getMessage(), e);
        }
    }
}