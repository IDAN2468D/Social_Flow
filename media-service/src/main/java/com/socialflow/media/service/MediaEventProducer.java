package com.socialflow.media.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class MediaEventProducer {

    private static final Logger log = LoggerFactory.getLogger(MediaEventProducer.class);
    private static final String MEDIA_EVENTS_TOPIC = "media-events";

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public MediaEventProducer(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    public void emitUploadUrlGenerated(Long userId, String fileKey, String filename, String contentType, String accessUrl) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", "MEDIA_UPLOAD_URL_GENERATED");
        payload.put("userId", userId);
        payload.put("fileKey", fileKey);
        payload.put("filename", filename);
        payload.put("contentType", contentType);
        payload.put("accessUrl", accessUrl);
        payload.put("timestamp", Instant.now().toString());
        send(fileKey, payload);
    }

    public void emitMediaDeleted(Long userId, String fileKey) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("eventType", "MEDIA_DELETED");
        payload.put("userId", userId);
        payload.put("fileKey", fileKey);
        payload.put("timestamp", Instant.now().toString());
        send(fileKey, payload);
    }

    private void send(String key, Map<String, Object> payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send(MEDIA_EVENTS_TOPIC, key, json);
            log.info("Emitted {} to topic '{}': {}", payload.get("eventType"), MEDIA_EVENTS_TOPIC, json);
        } catch (Exception e) {
            log.error("Failed to emit media event to Kafka topic '{}': {}", MEDIA_EVENTS_TOPIC, e.getMessage(), e);
        }
    }
}
