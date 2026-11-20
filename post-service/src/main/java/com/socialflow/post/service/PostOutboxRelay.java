package com.socialflow.post.service;

import com.socialflow.post.model.PostOutboxEvent;
import com.socialflow.post.repository.PostOutboxEventRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Service
@Slf4j
public class PostOutboxRelay {

    private final PostOutboxEventRepository outboxRepository;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final boolean enabled;
    private final int batchSize;
    private final int maxRetries;
    private final long sendTimeoutSeconds;

    public PostOutboxRelay(
            PostOutboxEventRepository outboxRepository,
            KafkaTemplate<String, String> kafkaTemplate,
            @Value("${outbox.relay.enabled:${KAFKA_AUTO_STARTUP:true}}") boolean enabled,
            @Value("${outbox.relay.batch-size:50}") int batchSize,
            @Value("${outbox.relay.max-retries:5}") int maxRetries,
            @Value("${outbox.relay.send-timeout-seconds:5}") long sendTimeoutSeconds) {
        this.outboxRepository = outboxRepository;
        this.kafkaTemplate = kafkaTemplate;
        this.enabled = enabled;
        this.batchSize = Math.max(1, batchSize);
        this.maxRetries = Math.max(1, maxRetries);
        this.sendTimeoutSeconds = Math.max(1L, sendTimeoutSeconds);
    }

    @Scheduled(fixedDelayString = "${outbox.relay.poll-interval-ms:1000}")
    @Transactional
    public int publishPendingEvents() {
        if (!enabled) {
            return 0;
        }
        return relayBatch();
    }

    @Transactional
    public int relayBatch() {
        List<PostOutboxEvent> pending = outboxRepository.findPendingBatchForUpdate(batchSize);
        if (pending.isEmpty()) {
            return 0;
        }

        int publishedCount = 0;
        for (PostOutboxEvent event : pending) {
            try {
                kafkaTemplate.send(event.getTopic(), event.getPartitionKey(), event.getPayload())
                        .get(sendTimeoutSeconds, TimeUnit.SECONDS);
                event.setStatus(PostOutboxEvent.OutboxStatus.PUBLISHED);
                event.setPublishedAt(LocalDateTime.now());
                event.setLastError(null);
                publishedCount++;
                log.info("Outbox relayed {} [eventId={}] to topic '{}'", event.getEventType(), event.getEventId(), event.getTopic());
            } catch (Exception ex) {
                if (ex instanceof InterruptedException) {
                    Thread.currentThread().interrupt();
                }
                int nextRetries = event.getRetryCount() + 1;
                event.setRetryCount(nextRetries);
                event.setLastError(ex.getMessage());
                if (nextRetries >= maxRetries) {
                    event.setStatus(PostOutboxEvent.OutboxStatus.FAILED);
                    log.error("Outbox event {} [eventId={}] marked FAILED after {} attempts: {}",
                            event.getEventType(), event.getEventId(), nextRetries, ex.getMessage());
                } else {
                    log.warn("Outbox relay failed for {} [eventId={}] (attempt {}/{}): {}",
                            event.getEventType(), event.getEventId(), nextRetries, maxRetries, ex.getMessage());
                }
            }
            outboxRepository.save(event);
        }
        return publishedCount;
    }
}
