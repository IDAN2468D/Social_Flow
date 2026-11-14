package com.socialflow.feed;

import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.dto.TrendingTagDto;
import com.socialflow.feed.model.FollowerRelation;
import com.socialflow.feed.repository.FollowerRelationRepository;
import com.socialflow.feed.repository.PostElasticsearchRepository;
import com.socialflow.feed.service.FeedService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;

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
}
