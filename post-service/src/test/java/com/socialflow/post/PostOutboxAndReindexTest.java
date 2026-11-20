package com.socialflow.post;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.socialflow.post.config.UserPrincipal;
import com.socialflow.post.controller.PostController;
import com.socialflow.post.event.PostCreatedEvent;
import com.socialflow.post.event.PostLikedEvent;
import com.socialflow.post.model.Post;
import com.socialflow.post.model.PostOutboxEvent;
import com.socialflow.post.repository.*;
import com.socialflow.post.service.PostKafkaProducer;
import com.socialflow.post.service.PostOutboxRelay;
import com.socialflow.post.service.PostService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PostOutboxAndReindexTest {

    @Mock private PostOutboxEventRepository outboxRepository;
    @Mock private KafkaTemplate<String, String> kafkaTemplate;
    @Mock private PostRepository postRepository;
    @Mock private PostLikeRepository postLikeRepository;
    @Mock private CommentRepository commentRepository;
    @Mock private PostReactionRepository postReactionRepository;
    @Mock private PostBookmarkRepository postBookmarkRepository;
    @Mock private PollRepository pollRepository;
    @Mock private PollOptionRepository pollOptionRepository;
    @Mock private PollVoteRepository pollVoteRepository;

    private ObjectMapper objectMapper;
    private PostKafkaProducer postKafkaProducer;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        postKafkaProducer = new PostKafkaProducer(outboxRepository, objectMapper);
    }

    @Test
    @DisplayName("PostKafkaProducer persists outbox events atomically with UUID eventId across post, reaction, and moderation topics")
    void postKafkaProducerEnqueuesOutboxEventsWithEventId() throws Exception {
        postKafkaProducer.emitPostCreated(PostCreatedEvent.builder()
                .postId(10L)
                .authorId(1L)
                .authorUsername("idan")
                .content("Hello outbox!")
                .tags(List.of("kafka"))
                .mentions(Set.of())
                .createdAt(LocalDateTime.now())
                .build());

        postKafkaProducer.emitPostLiked(PostLikedEvent.builder()
                .postId(10L)
                .userId(2L)
                .username("noa")
                .authorId(1L)
                .liked(true)
                .build());

        postKafkaProducer.emitModerationEvent("POST_FLAGGED", 10L, Map.of("severity", "HIGH"));

        ArgumentCaptor<PostOutboxEvent> captor = ArgumentCaptor.forClass(PostOutboxEvent.class);
        verify(outboxRepository, times(3)).save(captor.capture());

        List<PostOutboxEvent> saved = captor.getAllValues();
        assertThat(saved.get(0).getTopic()).isEqualTo("post-events");
        assertThat(saved.get(0).getEventType()).isEqualTo("POST_CREATED");
        assertThat(saved.get(0).getStatus()).isEqualTo(PostOutboxEvent.OutboxStatus.PENDING);
        JsonNode createdJson = objectMapper.readTree(saved.get(0).getPayload());
        assertThat(createdJson.get("eventId").asText()).isEqualTo(saved.get(0).getEventId());
        assertThat(createdJson.get("postId").asLong()).isEqualTo(10L);

        assertThat(saved.get(1).getTopic()).isEqualTo("reaction-events");
        assertThat(saved.get(1).getEventType()).isEqualTo("POST_LIKED");

        assertThat(saved.get(2).getTopic()).isEqualTo("moderation-events");
        assertThat(saved.get(2).getEventType()).isEqualTo("POST_FLAGGED");
    }

    @Test
    @DisplayName("PostOutboxRelay marks events PUBLISHED on Kafka ack and FAILED after max retries")
    @SuppressWarnings("unchecked")
    void outboxRelayPublishesAndHandlesRetries() {
        PostOutboxEvent okEvent = PostOutboxEvent.builder()
                .id(1L)
                .eventId("evt-ok")
                .aggregateType("POST")
                .aggregateId("10")
                .topic("post-events")
                .partitionKey("10")
                .eventType("POST_CREATED")
                .payload("{\"eventId\":\"evt-ok\"}")
                .status(PostOutboxEvent.OutboxStatus.PENDING)
                .retryCount(0)
                .build();

        PostOutboxEvent failingEvent = PostOutboxEvent.builder()
                .id(2L)
                .eventId("evt-fail")
                .aggregateType("POST")
                .aggregateId("11")
                .topic("post-events")
                .partitionKey("11")
                .eventType("POST_CREATED")
                .payload("{\"eventId\":\"evt-fail\"}")
                .status(PostOutboxEvent.OutboxStatus.PENDING)
                .retryCount(2)
                .build();

        when(outboxRepository.findPendingBatchForUpdate(50)).thenReturn(List.of(okEvent, failingEvent));
        when(kafkaTemplate.send("post-events", "10", "{\"eventId\":\"evt-ok\"}"))
                .thenReturn(CompletableFuture.completedFuture(mock(SendResult.class)));
        CompletableFuture<SendResult<String, String>> failedFuture = new CompletableFuture<>();
        failedFuture.completeExceptionally(new RuntimeException("Kafka broker unreachable"));
        when(kafkaTemplate.send("post-events", "11", "{\"eventId\":\"evt-fail\"}"))
                .thenReturn(failedFuture);

        PostOutboxRelay relay = new PostOutboxRelay(outboxRepository, kafkaTemplate, true, 50, 3, 5);
        int published = relay.publishPendingEvents();

        assertThat(published).isEqualTo(1);
        assertThat(okEvent.getStatus()).isEqualTo(PostOutboxEvent.OutboxStatus.PUBLISHED);
        assertThat(okEvent.getPublishedAt()).isNotNull();

        assertThat(failingEvent.getRetryCount()).isEqualTo(3);
        assertThat(failingEvent.getStatus()).isEqualTo(PostOutboxEvent.OutboxStatus.FAILED);
        assertThat(failingEvent.getLastError()).contains("Kafka broker unreachable");
        verify(outboxRepository, times(2)).save(any(PostOutboxEvent.class));
    }

    @Test
    @DisplayName("PostOutboxRelay skips polling when disabled (KAFKA_AUTO_STARTUP=false)")
    void outboxRelayDisabledSkipsPolling() {
        PostOutboxRelay disabledRelay = new PostOutboxRelay(outboxRepository, kafkaTemplate, false, 50, 5, 5);
        assertThat(disabledRelay.publishPendingEvents()).isZero();
        verifyNoInteractions(outboxRepository, kafkaTemplate);
    }

    @Test
    @DisplayName("POST /api/v1/posts/admin/reindex requires ADMIN and enqueues POST_REINDEX snapshots")
    void adminReindexEnforcesAdminAndEnqueuesSnapshots() throws Exception {
        Post p1 = Post.builder()
                .id(1L).authorId(10L).authorUsername("idan").content("Post 1")
                .likesCount(7).commentsCount(3).repostsCount(2).isPinned(true)
                .visibility("PUBLIC").createdAt(LocalDateTime.now())
                .build();
        Post p2 = Post.builder()
                .id(2L).authorId(11L).authorUsername("noa").content("Post 2")
                .likesCount(1).commentsCount(0).repostsCount(0).isPinned(false)
                .visibility("PUBLIC").createdAt(LocalDateTime.now())
                .build();

        when(postRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(p1, p2)));

        PostService postService = new PostService(
                postRepository, postLikeRepository, commentRepository, postReactionRepository,
                postBookmarkRepository, pollRepository, pollOptionRepository, pollVoteRepository,
                postKafkaProducer
        );
        PostController controller = new PostController(postService);

        UserPrincipal normalUser = new UserPrincipal(10L, "idan", "USER");
        assertThatThrownBy(() -> controller.reindexAllPosts(100, normalUser, "ADMIN"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        UserPrincipal adminUser = new UserPrincipal(1L, "admin", "ADMIN");
        ResponseEntity<Map<String, Object>> response = controller.reindexAllPosts(100, adminUser, "ADMIN");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(response.getBody()).containsEntry("status", "REINDEX_ENQUEUED");
        assertThat(response.getBody()).containsEntry("postsEnqueued", 2L);
        assertThat(response.getBody()).containsEntry("batches", 1);

        ArgumentCaptor<PostOutboxEvent> captor = ArgumentCaptor.forClass(PostOutboxEvent.class);
        verify(outboxRepository, times(2)).save(captor.capture());
        JsonNode snap1 = objectMapper.readTree(captor.getAllValues().get(0).getPayload());
        assertThat(snap1.get("eventType").asText()).isEqualTo("POST_REINDEX");
        assertThat(snap1.get("likesCount").asInt()).isEqualTo(7);
        assertThat(snap1.get("commentsCount").asInt()).isEqualTo(3);
        assertThat(snap1.get("isPinned").asBoolean()).isTrue();
    }
}
