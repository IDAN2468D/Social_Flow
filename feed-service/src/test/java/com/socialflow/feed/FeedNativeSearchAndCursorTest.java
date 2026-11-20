package com.socialflow.feed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.feed.config.ElasticsearchIndexBootstrap;
import com.socialflow.feed.controller.FeedController;
import com.socialflow.feed.controller.SearchController;
import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.dto.CursorPageResponse;
import com.socialflow.feed.repository.FollowerRelationRepository;
import com.socialflow.feed.repository.PostElasticsearchRepository;
import com.socialflow.feed.service.FeedService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.IndexOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.TotalHitsRelation;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeedNativeSearchAndCursorTest {

    @Mock private PostElasticsearchRepository postSearchRepository;
    @Mock private FollowerRelationRepository followerRelationRepository;
    @Mock private ElasticsearchOperations elasticsearchOperations;
    @Mock private IndexOperations indexOperations;

    private FeedService nativeFeedService;
    private FeedService fallbackFeedService;

    @BeforeEach
    void setUp() {
        nativeFeedService = new FeedService(
                postSearchRepository, followerRelationRepository, elasticsearchOperations, new ObjectMapper());
        fallbackFeedService = new FeedService(postSearchRepository, followerRelationRepository);
    }

    @Test
    @DisplayName("ElasticsearchIndexBootstrap defines ES 8.13 Basic mapping with 768-dim int8_hnsw dense_vector")
    @SuppressWarnings("unchecked")
    void indexBootstrapCreatesEs813BasicInt8HnswMapping() {
        Document mapping = ElasticsearchIndexBootstrap.buildMappingDocument();
        Map<String, Object> props = (Map<String, Object>) mapping.get("properties");
        assertThat(props).containsKeys("content", "tags", "aiTags", "aiCategory", "sentiment", "hidden", "embedding");

        Map<String, Object> embedding = (Map<String, Object>) props.get("embedding");
        assertThat(embedding.get("type")).isEqualTo("dense_vector");
        assertThat(embedding.get("dims")).isEqualTo(768);
        assertThat(embedding.get("similarity")).isEqualTo("cosine");
        Map<String, Object> indexOptions = (Map<String, Object>) embedding.get("index_options");
        assertThat(indexOptions.get("type")).isEqualTo("int8_hnsw");

        when(elasticsearchOperations.indexOps(IndexCoordinates.of("posts"))).thenReturn(indexOperations);
        when(indexOperations.exists()).thenReturn(false);
        when(indexOperations.create(any(Document.class), any(Document.class))).thenReturn(true);

        ElasticsearchIndexBootstrap bootstrap = new ElasticsearchIndexBootstrap(elasticsearchOperations);
        bootstrap.ensurePostsIndexExists();

        verify(indexOperations).create(any(Document.class), any(Document.class));
    }

    @Test
    @DisplayName("Native ES search_after cursor pagination encodes nextCursor and passes searchAfter on next page")
    @SuppressWarnings("unchecked")
    void nativeCursorPaginationUsesSearchAfter() {
        PostDocument d1 = PostDocument.builder().id("10").postId(10L).content("First").createdAt(LocalDateTime.now()).build();
        PostDocument d2 = PostDocument.builder().id("9").postId(9L).content("Second").createdAt(LocalDateTime.now().minusMinutes(1)).build();
        PostDocument d3 = PostDocument.builder().id("8").postId(8L).content("Third").createdAt(LocalDateTime.now().minusMinutes(2)).build();

        SearchHit<PostDocument> h1 = new SearchHit<>("posts", "10", null, 1.0f, new Object[]{1700000000L, 10L}, null, null, null, null, null, d1);
        SearchHit<PostDocument> h2 = new SearchHit<>("posts", "9", null, 1.0f, new Object[]{1699999900L, 9L}, null, null, null, null, null, d2);
        SearchHit<PostDocument> h3 = new SearchHit<>("posts", "8", null, 1.0f, new Object[]{1699999800L, 8L}, null, null, null, null, null, d3);

        SearchHits<PostDocument> firstHits = mock(SearchHits.class);
        when(firstHits.getSearchHits()).thenReturn(List.of(h1, h2, h3));

        SearchHits<PostDocument> secondHits = mock(SearchHits.class);
        when(secondHits.getSearchHits()).thenReturn(List.of(h3));

        when(elasticsearchOperations.search(any(NativeQuery.class), eq(PostDocument.class), eq(IndexCoordinates.of("posts"))))
                .thenReturn(firstHits)
                .thenReturn(secondHits);

        CursorPageResponse<PostDocument> page1 = nativeFeedService.getFeedCursor("trending", null, null, 2);
        assertThat(page1.getItems()).extracting(PostDocument::getPostId).containsExactly(10L, 9L);
        assertThat(page1.isHasMore()).isTrue();
        assertThat(page1.getNextCursor()).isNotBlank();

        CursorPageResponse<PostDocument> page2 = nativeFeedService.getFeedCursor("trending", null, page1.getNextCursor(), 2);
        assertThat(page2.getItems()).extracting(PostDocument::getPostId).containsExactly(8L);
        assertThat(page2.isHasMore()).isFalse();
        assertThat(page2.getNextCursor()).isNull();

        ArgumentCaptor<NativeQuery> queryCaptor = ArgumentCaptor.forClass(NativeQuery.class);
        verify(elasticsearchOperations, times(2))
                .search(queryCaptor.capture(), eq(PostDocument.class), eq(IndexCoordinates.of("posts")));
        assertThat(queryCaptor.getAllValues().get(1).getSearchAfter()).containsExactly(1699999900, 9);
    }

    @Test
    @DisplayName("Invalid cursor throws IllegalArgumentException when native ES is active")
    void invalidCursorThrowsIllegalArgument() {
        assertThatThrownBy(() -> nativeFeedService.getFeedCursor("for-you", null, "not!valid!base64!", 10))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid pagination cursor");
    }

    @Test
    @DisplayName("Fuzzy search, suggest, and facets work gracefully in fallback mode and via controllers")
    @SuppressWarnings("unchecked")
    void fuzzySuggestFacetsAndControllersWorkGracefully() {
        PostDocument p1 = PostDocument.builder()
                .id("1").postId(1L).authorUsername("idan")
                .content("לומדים #בינה_מלאכותית עם Spring Boot")
                .tags(List.of("בינה_מלאכותית", "spring"))
                .aiTags(List.of("ai", "java"))
                .aiCategory("Technology")
                .sentiment("POSITIVE")
                .createdAt(LocalDateTime.now())
                .build();
        PostDocument hidden = PostDocument.builder()
                .id("2").postId(2L).authorUsername("spammer")
                .content("Hidden spam")
                .tags(List.of("spam"))
                .hidden(true)
                .visibility("HIDDEN")
                .createdAt(LocalDateTime.now())
                .build();

        when(postSearchRepository.findAllByOrderByCreatedAtDesc(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(p1, hidden)));
        when(postSearchRepository.findByContentContainingIgnoreCase(eq("Spring"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(p1, hidden)));

        FeedController feedController = new FeedController(fallbackFeedService);
        ResponseEntity<CursorPageResponse<PostDocument>> cursorFeed = feedController.getCursorFeed("for-you", null, null, 10);
        assertThat(cursorFeed.getBody()).isNotNull();
        assertThat(cursorFeed.getBody().getItems()).extracting(PostDocument::getPostId).containsExactly(1L);

        SearchController searchController = new SearchController(fallbackFeedService);
        ResponseEntity<Page<PostDocument>> fuzzyRes = searchController.search("Spring", "", true, 0, 10);
        assertThat(fuzzyRes.getBody()).isNotNull();
        assertThat(fuzzyRes.getBody().getContent()).extracting(PostDocument::getPostId).containsExactly(1L);

        ResponseEntity<Map<String, Object>> suggestRes = searchController.suggest("בינה", "", 5);
        assertThat(suggestRes.getBody()).isNotNull();
        assertThat((List<String>) suggestRes.getBody().get("tags")).contains("בינה_מלאכותית");

        ResponseEntity<Map<String, Object>> facetsRes = searchController.facets("Spring", "", 5);
        assertThat(facetsRes.getBody()).isNotNull();
        assertThat(facetsRes.getBody().get("totalMatchingPosts")).isEqualTo(1L);
        List<Map<String, Object>> categories = (List<Map<String, Object>>) facetsRes.getBody().get("categories");
        assertThat(categories).hasSize(1);
        assertThat(categories.get(0)).containsEntry("key", "Technology").containsEntry("count", 1L);
    }
}
