package com.socialflow.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.user.event.UserFollowedEvent;
import com.socialflow.user.event.UserRegisteredEvent;
import com.socialflow.user.model.UserOutboxEvent;
import com.socialflow.user.repository.UserOutboxEventRepository;
import com.socialflow.user.service.UserEventProducer;
import com.socialflow.user.service.UserOutboxRelay;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

import java.util.List;
import java.util.concurrent.CompletableFuture;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserOutboxTest {

    @Mock
    private UserOutboxEventRepository outboxRepository;

    @Mock
    private KafkaTemplate<String, String> kafkaTemplate;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void userEventProducerEnqueuesOutboxEventsWithEventId() throws Exception {
        UserEventProducer producer = new UserEventProducer(outboxRepository);

        producer.emitUserRegistered(new UserRegisteredEvent(1L, "idan", "idan@example.com"));
        producer.emitUserFollowed(new UserFollowedEvent(1L, "idan", 2L, true));
        producer.emitUserProfileUpdated(1L, "idan", "Idan Kazam", "Backend Architect");

        ArgumentCaptor<UserOutboxEvent> captor = ArgumentCaptor.forClass(UserOutboxEvent.class);
        verify(outboxRepository, times(3)).save(captor.capture());

        List<UserOutboxEvent> events = captor.getAllValues();
        assertEquals("USER_REGISTERED", events.get(0).getEventType());
        assertEquals("user-events", events.get(0).getTopic());
        assertEquals(UserOutboxEvent.OutboxStatus.PENDING, events.get(0).getStatus());
        JsonNode regJson = objectMapper.readTree(events.get(0).getPayload());
        assertEquals(events.get(0).getEventId(), regJson.get("eventId").asText());

        assertEquals("USER_FOLLOWED", events.get(1).getEventType());
        assertEquals("USER_PROFILE_UPDATED", events.get(2).getEventType());
    }

    @Test
    @SuppressWarnings("unchecked")
    void userOutboxRelayPublishesAndRespectsDisabledFlag() {
        UserOutboxEvent pending = new UserOutboxEvent(
                "evt-u1", "USER", "1", "user-events", "user-registered:1", "USER_REGISTERED", "{\"eventId\":\"evt-u1\"}"
        );
        when(outboxRepository.findPendingBatchForUpdate(50)).thenReturn(List.of(pending));
        when(kafkaTemplate.send("user-events", "user-registered:1", "{\"eventId\":\"evt-u1\"}"))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));

        UserOutboxRelay relay = new UserOutboxRelay(outboxRepository, kafkaTemplate, true, 50, 5, 5);
        assertEquals(1, relay.publishPendingEvents());
        assertEquals(UserOutboxEvent.OutboxStatus.PUBLISHED, pending.getStatus());
        assertNotNull(pending.getPublishedAt());

        UserOutboxRelay disabled = new UserOutboxRelay(outboxRepository, kafkaTemplate, false, 50, 5, 5);
        assertEquals(0, disabled.publishPendingEvents());
        verify(outboxRepository, times(1)).findPendingBatchForUpdate(50);
    }
}
