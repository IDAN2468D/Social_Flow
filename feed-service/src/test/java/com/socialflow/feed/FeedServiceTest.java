package com.socialflow.feed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.feed.consumer.FeedKafkaConsumer;
import com.socialflow.feed.controller.SearchController;
import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.dto.TrendingTagDto;
import com.socialflow.feed.model.FollowerRelation;
import com.socialflow.feed.repository.FollowerRelationRepository;
import com.socialflow.feed.repository.PostElasticsearchRepository;
import com.socialflow.feed.service.FeedService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FeedServiceTest {

    @Mock
    private PostElasticsearchRepository postSearchRepository;

    @Mock
    private FollowerRelationRepository followerRelationRepository;

    @InjectMocks
    private FeedService feedService;

    private FeedKafkaConsumer feedKafkaConsumer;

    @BeforeEach
    void setUp() {
        feedKafkaConsumer = new FeedKafkaConsumer(
                postSearchRepository,
                followerRelationRepository,
                new ObjectMapper()
        );
    }

    @Test
    @DisplayName("getFollowingFeed aggregates followed IDs and calls repository")
    void getFollowingFeed_Success() {
        Long userId = 1L;
        FollowerRelation rel1 = FollowerRelation.builder().id(1L).followerId(1L).followingId(2L).build();
        FollowerRelation rel2 = FollowerRelation.builder().id(2L).followerId(1L).followingId(3L).build();

        when(followerRelationRepository.findByFollowerId(userId)).thenReturn(List.of(rel1, rel2));

        PostDocument doc1 = PostDocument.builder().id("10").authorId(2L).content("From friend 1").build();
        Page<PostDocument> mockPage = new PageImpl<>(List.of(doc1));
        when(postSearchRepository.findByAuthorIdInOrderByCreatedAtDesc(eq(List.of(2L, 3L, 1L)), any(PageRequest.class)))
                .thenReturn(mockPage);

        Page<PostDocument> result = feedService.getFollowingFeed(userId, 0, 10);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getContent()).isEqualTo("From friend 1");
    }

    @Test
    @DisplayName("getForYouFeed ranks posts by engagement and recency")
    void getForYouFeed_Success() {
        Long userId = 1L;
        PostDocument post1 = PostDocument.builder()
                .id("1")
                .authorId(2L)
                .likesCount(10)
                .commentsCount(2)
                .repostsCount(1)
                .createdAt(LocalDateTime.now().minusHours(1))
                .build();
        PostDocument post2 = PostDocument.builder()
                .id("2")
                .authorId(3L)
                .likesCount(1)
                .commentsCount(0)
                .repostsCount(0)
                .createdAt(LocalDateTime.now().minusHours(24))
                .build();

        when(followerRelationRepository.findByFollowerId(userId)).thenReturn(List.of());
        when(postSearchRepository.findAllByOrderByCreatedAtDesc(any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(post1, post2)));

        Page<PostDocument> result = feedService.getForYouFeed(userId, 0, 10);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).hasSize(2);
        // Post1 should rank higher due to higher likes and recency
        assertThat(result.getContent().get(0).getId()).isEqualTo("1");
    }

    @Test
    @DisplayName("getTrendingFeed returns posts sorted by likes")
    void getTrendingFeed_Success() {
        PostDocument p1 = PostDocument.builder().id("1").likesCount(100).build();
        when(postSearchRepository.findAllByOrderByLikesCountDesc(any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(p1)));

        Page<PostDocument> result = feedService.getTrendingFeed(0, 10);

        assertThat(result).isNotNull();
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getLikesCount()).isEqualTo(100);
    }

    @Test
    @DisplayName("getTrendingHashtags aggregates hashtags from recent posts")
    void getTrendingHashtags_Success() {
        PostDocument doc1 = PostDocument.builder().id("1").tags(List.of("java", "spring")).build();
        PostDocument doc2 = PostDocument.builder().id("2").tags(List.of("spring", "microservices")).build();

        when(postSearchRepository.findAllByOrderByCreatedAtDesc(any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(doc1, doc2)));

        List<TrendingTagDto> tags = feedService.getTrendingHashtags(5);

        assertThat(tags).isNotNull();
        assertThat(tags).isNotEmpty();
        assertThat(tags.get(0).getTag()).isEqualTo("spring");
        assertThat(tags.get(0).getCount()).isEqualTo(2L);
    }

    @Test
    @DisplayName("consumePostEvent handles CommentCreatedEvent without overwriting post content or likes")
    void consumePostEvent_CommentCreated_IncrementsCommentsWithoutOverwritingPost() {
        PostDocument existingDoc = PostDocument.builder()
                .id("10")
                .postId(10L)
                .authorId(1L)
                .authorUsername("idan")
                .content("Original post content")
                .likesCount(5)
                .commentsCount(2)
                .repostsCount(1)
                .tags(List.of("java", "spring"))
                .build();

        when(postSearchRepository.findByPostId(10L)).thenReturn(Optional.of(existingDoc));

        String commentEventJson = """
                {
                  "eventType": "COMMENT_CREATED",
                  "commentId": 99,
                  "postId": 10,
                  "authorId": 2,
                  "authorUsername": "noa",
                  "postAuthorId": 1,
                  "content": "This is a comment, NOT a post!"
                }
                """;
        feedKafkaConsumer.consumePostEvent(commentEventJson);

        // Also test legacy CommentCreatedEvent without eventType field
        String legacyCommentEventJson = """
                {
                  "commentId": 100,
                  "postId": 10,
                  "authorId": 3,
                  "content": "Legacy comment"
                }
                """;
        feedKafkaConsumer.consumePostEvent(legacyCommentEventJson);

        ArgumentCaptor<PostDocument> captor = ArgumentCaptor.forClass(PostDocument.class);
        verify(postSearchRepository, times(2)).save(captor.capture());
        PostDocument savedDoc = captor.getValue();

        assertThat(savedDoc.getCommentsCount()).isEqualTo(4);
        assertThat(savedDoc.getContent()).isEqualTo("Original post content");
        assertThat(savedDoc.getLikesCount()).isEqualTo(5);
        assertThat(savedDoc.getRepostsCount()).isEqualTo(1);
        assertThat(savedDoc.getAuthorUsername()).isEqualTo("idan");
        assertThat(savedDoc.getTags()).containsExactly("java", "spring");
    }

    @Test
    @DisplayName("consumePostEvent handles POST_PINNED without deleting or overwriting post")
    void consumePostEvent_PostPinned_UpdatesPinnedState() {
        PostDocument existingDoc = PostDocument.builder()
                .id("10")
                .postId(10L)
                .content("Pinned post")
                .isPinned(false)
                .build();
        when(postSearchRepository.findByPostId(10L)).thenReturn(Optional.of(existingDoc));

        String pinEventJson = """
                {
                  "eventType": "POST_PINNED",
                  "postId": 10,
                  "authorId": 1,
                  "pinned": true
                }
                """;
        feedKafkaConsumer.consumePostEvent(pinEventJson);

        verify(postSearchRepository, times(1)).save(existingDoc);
        verify(postSearchRepository, never()).delete(any());
        assertThat(existingDoc.isPinned()).isTrue();
        assertThat(existingDoc.getContent()).isEqualTo("Pinned post");
    }

    @Test
    @DisplayName("consumeUserEvent deletes follower relation when follow/isFollow is false")
    void consumeUserEvent_Unfollow_DeletesRelation() {
        String unfollowJson = """
                {
                  "followerId": 1,
                  "followingId": 2,
                  "follow": false
                }
                """;
        feedKafkaConsumer.consumeUserEvent(unfollowJson);
        verify(followerRelationRepository, times(1)).deleteByFollowerIdAndFollowingId(1L, 2L);

        String unfollowAltJson = """
                {
                  "followerId": 1,
                  "followingId": 3,
                  "isFollow": false
                }
                """;
        feedKafkaConsumer.consumeUserEvent(unfollowAltJson);
        verify(followerRelationRepository, times(1)).deleteByFollowerIdAndFollowingId(1L, 3L);
        verify(followerRelationRepository, never()).save(any());
    }

    @Test
    @DisplayName("searchMulti returns matching posts, distinct users, and matching tags with counts")
    @SuppressWarnings("unchecked")
    void searchMulti_ReturnsPostsUsersAndTags() {
        PostDocument doc1 = PostDocument.builder()
                .id("1")
                .postId(1L)
                .authorUsername("idan")
                .authorAvatar("https://avatar/idan.png")
                .content("Building Spring Boot microservices")
                .tags(List.of("spring", "microservices"))
                .build();
        PostDocument doc2 = PostDocument.builder()
                .id("2")
                .postId(2L)
                .authorUsername("noa")
                .authorAvatar("https://avatar/noa.png")
                .content("Kafka streams with Spring")
                .tags(List.of("spring", "kafka"))
                .build();
        PostDocument doc3 = PostDocument.builder()
                .id("3")
                .postId(3L)
                .authorUsername("idan")
                .authorAvatar("https://avatar/idan.png")
                .content("Unrelated frontend UI post")
                .tags(List.of("nextjs"))
                .build();

        when(postSearchRepository.findByContentContainingIgnoreCase(eq("spring"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(doc1, doc2)));
        when(postSearchRepository.findAllByOrderByCreatedAtDesc(any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(doc1, doc2, doc3)));

        Map<String, Object> result = feedService.searchMulti("spring", 0, 10);

        List<PostDocument> posts = (List<PostDocument>) result.get("posts");
        List<Map<String, String>> users = (List<Map<String, String>>) result.get("users");
        List<Map<String, Object>> tags = (List<Map<String, Object>>) result.get("tags");

        assertThat(posts).extracting(PostDocument::getPostId).containsExactly(1L, 2L);
        assertThat(users).hasSize(2);
        assertThat(users).extracting(u -> u.get("username")).containsExactly("idan", "noa");
        assertThat(tags).hasSize(1);
        assertThat(tags.get(0).get("tag")).isEqualTo("spring");
        assertThat(tags.get(0).get("count")).isEqualTo(2L);

        // Verify SearchController handles both q and query params on / and /multi
        SearchController controller = new SearchController(feedService);
        ResponseEntity<Page<PostDocument>> searchViaQuery = controller.search("", "spring", 0, 10);
        assertThat(searchViaQuery.getBody()).isNotNull();
        assertThat(searchViaQuery.getBody().getContent()).hasSize(2);

        ResponseEntity<Map<String, Object>> multiViaQ = controller.searchMulti("spring", "", 0, 10);
        assertThat(multiViaQ.getBody()).isNotNull();
        assertThat((List<PostDocument>) multiViaQ.getBody().get("posts")).hasSize(2);
    }

    @Test
    @DisplayName("searchMulti matches authorUsername even when query is not in post content")
    @SuppressWarnings("unchecked")
    void searchMulti_MatchesByAuthorUsername() {
        PostDocument doc = PostDocument.builder()
                .id("9")
                .postId(9L)
                .authorUsername("daniel")
                .authorAvatar("https://avatar/daniel.png")
                .content("Kafka event pipeline")
                .tags(List.of("kafka"))
                .build();

        when(postSearchRepository.findByContentContainingIgnoreCase(eq("daniel"), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(postSearchRepository.findAllByOrderByCreatedAtDesc(any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(doc)));

        Map<String, Object> result = feedService.searchMulti("daniel", 0, 10);

        List<PostDocument> posts = (List<PostDocument>) result.get("posts");
        List<Map<String, String>> users = (List<Map<String, String>>) result.get("users");
        assertThat(posts).extracting(PostDocument::getPostId).containsExactly(9L);
        assertThat(users).hasSize(1);
        assertThat(users.get(0)).containsEntry("username", "daniel");
    }
}
