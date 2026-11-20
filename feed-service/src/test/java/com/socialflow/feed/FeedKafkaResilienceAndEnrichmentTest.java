package com.socialflow.feed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.feed.consumer.FeedKafkaConsumer;
import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.model.FeedProcessedEvent;
import com.socialflow.feed.repository.FeedProcessedEventRepository;
import com.socialflow.feed.repository.FollowerRelationRepository;
import com.socialflow.feed.repository.PostElasticsearchRepository;
import com.socialflow.feed.service.FeedService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.RetryableTopic;

import java.lang.reflect.Method;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeedKafkaResilienceAndEnrichmentTest {

    @Mock private PostElasticsearchRepository postSearchRepository;
    @Mock private FollowerRelationRepository followerRelationRepository;
    @Mock private FeedProcessedEventRepository processedEventRepository;

    private FeedKafkaConsumer consumer;
    private FeedService feedService;

    @BeforeEach
    void setUp() {
        consumer = new FeedKafkaConsumer(
                postSearchRepository,
                followerRelationRepository,
                processedEventRepository,
                new ObjectMapper()
        );
        feedService = new FeedService(postSearchRepository, followerRelationRepository);
    }

    @Test
    @DisplayName("Idempotency: duplicate eventId in feed_processed_events is safely skipped")
    void duplicateEventIdIsSkippedIdempotently() {
        PostDocument doc = PostDocument.builder().id("10").postId(10L).likesCount(3).build();
        when(postSearchRepository.findByPostId(10L)).thenReturn(Optional.of(doc));
        when(processedEventRepository.existsById("evt-like-1")).thenReturn(false).thenReturn(true);

        String likeJson = """
                {
                  "eventId": "evt-like-1",
                  "eventType": "POST_LIKED",
                  "postId": 10,
                  "userId": 2,
                  "authorId": 1,
                  "liked": true
                }
                """;

        consumer.consumePostEvent(likeJson);
        consumer.consumePostEvent(likeJson);

        assertThat(doc.getLikesCount()).isEqualTo(4);
        verify(postSearchRepository, times(1)).save(doc);
        verify(processedEventRepository, times(1)).save(any(FeedProcessedEvent.class));
    }

    @Test
    @DisplayName("Malformed JSON and transient ES errors propagate (no silent catch) and do not mark event processed")
    void exceptionsPropagateForRetryAndDltWithoutMarkingProcessed() {
        assertThatThrownBy(() -> consumer.consumePostEvent("{not-valid-json"))
                .isInstanceOf(IllegalArgumentException.class);
        verify(processedEventRepository, never()).save(any());

        when(processedEventRepository.existsById("evt-es-down")).thenReturn(false);
        when(postSearchRepository.findByPostId(55L)).thenThrow(new RuntimeException("ES timeout"));

        String likeJson = "{\"eventId\":\"evt-es-down\",\"eventType\":\"POST_LIKED\",\"postId\":55,\"liked\":true}";
        assertThatThrownBy(() -> consumer.consumePostEvent(likeJson))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("ES timeout");
        verify(processedEventRepository, never()).save(any());
    }

    @Test
    @DisplayName("POST_REINDEX rebuilds PostDocument counts while preserving existing AI metadata")
    void postReindexRestoresCountsAndPreservesAiMetadata() {
        PostDocument existing = PostDocument.builder()
                .id("10").postId(10L)
                .aiTags(List.of("ai", "java"))
                .sentiment("POSITIVE")
                .aiSummary("Great microservices summary")
                .moderationStatus("APPROVED")
                .build();
        when(processedEventRepository.existsById("evt-reindex-1")).thenReturn(false);
        when(postSearchRepository.findByPostId(10L)).thenReturn(Optional.of(existing));

        String reindexJson = """
                {
                  "eventId": "evt-reindex-1",
                  "eventType": "POST_REINDEX",
                  "postId": 10,
                  "authorId": 1,
                  "authorUsername": "idan",
                  "content": "Recovered post",
                  "likesCount": 14,
                  "commentsCount": 6,
                  "repostsCount": 3,
                  "isPinned": true,
                  "visibility": "PUBLIC"
                }
                """;

        consumer.consumePostEvent(reindexJson);

        verify(postSearchRepository).save(argThat(saved ->
                saved.getPostId().equals(10L)
                        && saved.getLikesCount() == 14
                        && saved.getCommentsCount() == 6
                        && saved.getRepostsCount() == 3
                        && saved.isPinned()
                        && "POSITIVE".equals(saved.getSentiment())
                        && "Great microservices summary".equals(saved.getAiSummary())
                        && List.of("ai", "java").equals(saved.getAiTags())
        ));
    }

    @Test
    @DisplayName("ai-enrichment-events POST_ENRICHED merges aiTags, sentiment, and summary onto PostDocument")
    void aiEnrichmentPostEnrichedUpdatesDocument() {
        PostDocument doc = PostDocument.builder().id("20").postId(20L).content("Spring Boot + Kafka").build();
        when(processedEventRepository.existsById("evt-ai-1")).thenReturn(false);
        when(postSearchRepository.findByPostId(20L)).thenReturn(Optional.of(doc));

        String enrichedJson = """
                {
                  "eventId": "evt-ai-1",
                  "eventType": "POST_ENRICHED",
                  "postId": 20,
                  "authorId": 1,
                  "aiTags": ["#SpringBoot", "Kafka"],
                  "sentiment": "POSITIVE",
                  "summary": "Overview of Spring Boot with Kafka",
                  "category": "Technology",
                  "isSafe": true,
                  "severity": "LOW"
                }
                """;

        consumer.consumeAiEnrichmentEvent(enrichedJson);

        assertThat(doc.getAiTags()).containsExactly("springboot", "kafka");
        assertThat(doc.getSentiment()).isEqualTo("POSITIVE");
        assertThat(doc.getAiSummary()).isEqualTo("Overview of Spring Boot with Kafka");
        assertThat(doc.getAiCategory()).isEqualTo("Technology");
        assertThat(doc.getModerationStatus()).isEqualTo("APPROVED");
        assertThat(doc.isHidden()).isFalse();
        verify(postSearchRepository, times(1)).save(doc);
        verify(processedEventRepository, times(1)).save(any(FeedProcessedEvent.class));
    }

    @Test
    @DisplayName("ai-enrichment-events CONTENT_FLAGGED with HIGH severity hides PostDocument and excludes it from feeds")
    void aiEnrichmentContentFlaggedHighSeverityHidesDocument() {
        PostDocument doc = PostDocument.builder()
                .id("30").postId(30L).authorId(2L).content("Harmful spam")
                .visibility("PUBLIC").createdAt(LocalDateTime.now())
                .build();
        PostDocument safeDoc = PostDocument.builder()
                .id("31").postId(31L).authorId(3L).content("Safe post")
                .visibility("PUBLIC").createdAt(LocalDateTime.now())
                .build();

        when(processedEventRepository.existsById("evt-flag-high")).thenReturn(false);
        when(postSearchRepository.findByPostId(30L)).thenReturn(Optional.of(doc));

        String flaggedJson = """
                {
                  "eventId": "evt-flag-high",
                  "eventType": "CONTENT_FLAGGED",
                  "postId": 30,
                  "authorId": 2,
                  "isSafe": false,
                  "severity": "HIGH",
                  "moderationReason": "Policy violation"
                }
                """;

        consumer.consumeAiEnrichmentEvent(flaggedJson);

        assertThat(doc.isHidden()).isTrue();
        assertThat(doc.getModerationStatus()).isEqualTo("HIDDEN");
        assertThat(doc.getVisibility()).isEqualTo("HIDDEN");
        assertThat(doc.getModerationReason()).isEqualTo("Policy violation");

        // FeedService excludes hidden posts from public feeds
        when(postSearchRepository.findAllByOrderByCreatedAtDesc(any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(doc, safeDoc)));
        Page<PostDocument> forYou = feedService.getForYouFeed(null, 0, 10);
        assertThat(forYou.getContent()).extracting(PostDocument::getPostId).containsExactly(31L);
    }

    @Test
    @DisplayName("ai-enrichment-events CONTENT_FLAGGED with MEDIUM severity marks FLAGGED without hiding")
    void aiEnrichmentContentFlaggedMediumMarksFlaggedWithoutHiding() {
        PostDocument doc = PostDocument.builder().id("32").postId(32L).visibility("PUBLIC").build();
        when(processedEventRepository.existsById("evt-flag-med")).thenReturn(false);
        when(postSearchRepository.findByPostId(32L)).thenReturn(Optional.of(doc));

        String flaggedJson = """
                {
                  "eventId": "evt-flag-med",
                  "eventType": "CONTENT_FLAGGED",
                  "postId": 32,
                  "severity": "MEDIUM",
                  "moderationReason": "Borderline tone"
                }
                """;

        consumer.consumeAiEnrichmentEvent(flaggedJson);

        assertThat(doc.isHidden()).isFalse();
        assertThat(doc.getModerationStatus()).isEqualTo("FLAGGED");
        assertThat(doc.getVisibility()).isEqualTo("PUBLIC");
    }

    @Test
    @DisplayName("FeedKafkaConsumer listeners declare @RetryableTopic and @DltHandler")
    void listenersDeclareRetryableTopicAndDltHandler() throws Exception {
        for (String methodName : List.of("consumePostEvent", "consumeUserEvent", "consumeAiEnrichmentEvent")) {
            Method m = FeedKafkaConsumer.class.getMethod(methodName, String.class);
            RetryableTopic retry = m.getAnnotation(RetryableTopic.class);
            assertThat(retry).as(methodName + " should have @RetryableTopic").isNotNull();
            assertThat(retry.dltTopicSuffix()).isEqualTo("-dlt");
            assertThat(retry.autoCreateTopics()).isEqualTo("false");
        }
        Method dlt = FeedKafkaConsumer.class.getMethod("handleDlt", String.class, String.class, String.class, String.class);
        assertThat(dlt.getAnnotation(DltHandler.class)).isNotNull();
    }
}
