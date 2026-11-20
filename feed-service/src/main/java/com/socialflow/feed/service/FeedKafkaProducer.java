package com.socialflow.feed.service;

import com.fasterxml.jackson.databind.ObjectMapper;
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
public class FeedKafkaProducer {

    private static final String FEED_EVENTS_TOPIC = "feed-events";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public Map<String, Object> emitFeedEvent(String eventType, String key, Map<String, Object> details) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", eventType);
        if (details != null) {
            payload.putAll(details);
        }
        payload.put("timestamp", Instant.now().toString());
        try {
            String json = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send(FEED_EVENTS_TOPIC, key != null ? key : eventType, json);
            log.info("Emitted {} to topic '{}': {}", eventType, FEED_EVENTS_TOPIC, json);
        } catch (Exception e) {
            log.error("Failed to emit {} to topic '{}': {}", eventType, FEED_EVENTS_TOPIC, e.getMessage(), e);
        }
        return payload;
    }
}
