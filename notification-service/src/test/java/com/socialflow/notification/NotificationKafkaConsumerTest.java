package com.socialflow.notification;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.notification.model.NotificationProcessedEvent;
import com.socialflow.notification.model.NotificationType;
import com.socialflow.notification.repository.NotificationProcessedEventRepository;
import com.socialflow.notification.service.NotificationKafkaConsumer;
import com.socialflow.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.RetryableTopic;

import java.lang.reflect.Method;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationKafkaConsumerTest {

    @Mock
    private NotificationService notificationService;

    @Mock
    private NotificationProcessedEventRepository processedEventRepository;

    private NotificationKafkaConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new NotificationKafkaConsumer(notificationService, processedEventRepository, new ObjectMapper());
    }

    @Test
    @DisplayName("Idempotency: duplicate eventId in notification_processed_events creates notification only once")
    void duplicateEventIdIsSkippedIdempotently() {
        when(processedEventRepository.existsById("evt-n1")).thenReturn(false).thenReturn(true);

        String likeJson = """
                {
                  "eventId": "evt-n1",
                  "eventType": "POST_LIKED",
                  "postId": 50,
                  "userId": 200,
                  "username": "bob",
                  "authorId": 100,
                  "liked": true
                }
                """;

        consumer.consumePostEvent(likeJson);
        consumer.consumePostEvent(likeJson);

        verify(notificationService, times(1)).createAndSendNotification(
                eq(100L), eq(200L), eq(NotificationType.LIKE), eq(50L), contains("bob")
        );
        verify(processedEventRepository, times(1)).save(any(NotificationProcessedEvent.class));
    }

    @Test
    @DisplayName("Malformed JSON and transient failures propagate instead of being swallowed")
    void exceptionsPropagateForRetryAndDlt() {
        assertThatThrownBy(() -> consumer.consumePostEvent("{bad-json"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(processedEventRepository, never()).save(any());

        when(processedEventRepository.existsById("evt-db-err")).thenReturn(false);
        doThrow(new RuntimeException("DB unavailable"))
                .when(notificationService).createAndSendNotification(any(), any(), any(), any(), any());

        String followJson = """
                {
                  "eventId": "evt-db-err",
                  "followerId": 200,
                  "followerUsername": "bob",
                  "followingId": 100,
                  "follow": true
                }
                """;
        assertThatThrownBy(() -> consumer.consumeUserEvent(followJson))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("DB unavailable");
        verify(processedEventRepository, never()).save(any());
    }

    @Test
    @DisplayName("ai-enrichment-events CONTENT_FLAGGED with HIGH severity alerts post author once")
    void contentFlaggedHighSeverityNotifiesAuthorIdempotently() {
        when(processedEventRepository.existsById("evt-flag-1")).thenReturn(false).thenReturn(true);

        String flaggedJson = """
                {
                  "eventId": "evt-flag-1",
                  "eventType": "CONTENT_FLAGGED",
                  "postId": 77,
                  "authorId": 100,
                  "severity": "HIGH"
                }
                """;

        consumer.consumeAiEnrichmentEvent(flaggedJson);
        consumer.consumeAiEnrichmentEvent(flaggedJson);

        verify(notificationService, times(1)).createAndSendNotification(
                eq(100L), eq(0L), eq(NotificationType.SYSTEM), eq(77L), contains("77")
        );
        verify(processedEventRepository, times(1)).save(any(NotificationProcessedEvent.class));
    }

    @Test
    @DisplayName("NotificationKafkaConsumer listeners declare @RetryableTopic and @DltHandler")
    void listenersDeclareRetryableTopicAndDltHandler() throws Exception {
        for (String methodName : List.of("consumePostEvent", "consumeUserEvent", "consumeAiEnrichmentEvent")) {
            Method m = NotificationKafkaConsumer.class.getMethod(methodName, String.class);
            RetryableTopic retry = m.getAnnotation(RetryableTopic.class);
            assertThat(retry).as(methodName + " should have @RetryableTopic").isNotNull();
            assertThat(retry.dltTopicSuffix()).isEqualTo("-dlt");
            assertThat(retry.autoCreateTopics()).isEqualTo("false");
        }
        Method dlt = NotificationKafkaConsumer.class.getMethod("handleDlt", String.class, String.class, String.class, String.class);
        assertThat(dlt.getAnnotation(DltHandler.class)).isNotNull();
    }
}
