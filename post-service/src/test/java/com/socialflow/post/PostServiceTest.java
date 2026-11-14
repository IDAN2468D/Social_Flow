package com.socialflow.post;

import com.socialflow.post.config.UserPrincipal;
import com.socialflow.post.dto.*;
import com.socialflow.post.event.PostCreatedEvent;
import com.socialflow.post.event.PostLikedEvent;
import com.socialflow.post.event.PostRepostedEvent;
import com.socialflow.post.model.*;
import com.socialflow.post.repository.*;
import com.socialflow.post.service.PostKafkaProducer;
import com.socialflow.post.service.PostService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PostServiceTest {

    @Mock
    private PostRepository postRepository;

    @Mock
    private PostLikeRepository postLikeRepository;

    @Mock
    private CommentRepository commentRepository;

    @Mock
    private PostReactionRepository postReactionRepository;

    @Mock
    private PostBookmarkRepository postBookmarkRepository;

    @Mock
    private PollRepository pollRepository;

    @Mock
    private PollOptionRepository pollOptionRepository;

    @Mock
    private PollVoteRepository pollVoteRepository;

    @Mock
    private PostKafkaProducer postKafkaProducer;

    @InjectMocks
    private PostService postService;

    private UserPrincipal testUser;

    @BeforeEach
    void setUp() {
        testUser = new UserPrincipal(100L, "idan");
    }

    @Test
    @DisplayName("createPost creates post and emits kafka event")
    void createPost_Success() {
        CreatePostRequest request = CreatePostRequest.builder()
                .content("Hello #world and @dan")
                .visibility("PUBLIC")
                .build();

        Post savedPost = Post.builder()
                .id(1L)
                .authorId(testUser.getUserId())
                .authorUsername(testUser.getUsername())
                .content(request.getContent())
                .visibility("PUBLIC")
                .likesCount(0)
                .commentsCount(0)
                .repostsCount(0)
                .createdAt(LocalDateTime.now())
                .tags(List.of("world"))
                .mentions(Set.of("dan"))
                .build();

        when(postRepository.save(any(Post.class))).thenReturn(savedPost);

        PostResponseDto result = postService.createPost(request, testUser);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getContent()).isEqualTo("Hello #world and @dan");
        verify(postKafkaProducer, times(1)).emitPostCreated(any(PostCreatedEvent.class));
    }

    @Test
    @DisplayName("toggleLike adds like when not previously liked")
    void toggleLike_AddsLike() {
        Post post = Post.builder()
                .id(1L)
                .authorId(200L)
                .likesCount(0)
                .build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(post));
        when(postLikeRepository.existsByPostIdAndUserId(1L, 100L)).thenReturn(false);
        when(postRepository.save(any(Post.class))).thenReturn(post);

        boolean liked = postService.toggleLike(1L, testUser);

        assertThat(liked).isTrue();
        assertThat(post.getLikesCount()).isEqualTo(1);
        verify(postLikeRepository, times(1)).save(any(PostLike.class));
        verify(postKafkaProducer, times(1)).emitPostLiked(any(PostLikedEvent.class));
    }

    @Test
    @DisplayName("toggleLike removes like when already liked")
    void toggleLike_RemovesLike() {
        Post post = Post.builder()
                .id(1L)
                .authorId(200L)
                .likesCount(1)
                .build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(post));
        when(postLikeRepository.existsByPostIdAndUserId(1L, 100L)).thenReturn(true);
        when(postRepository.save(any(Post.class))).thenReturn(post);

        boolean liked = postService.toggleLike(1L, testUser);

        assertThat(liked).isFalse();
        assertThat(post.getLikesCount()).isEqualTo(0);
        verify(postLikeRepository, times(1)).deleteByPostIdAndUserId(1L, 100L);
        verify(postKafkaProducer, times(1)).emitPostLiked(any(PostLikedEvent.class));
    }

    @Test
    @DisplayName("repost increments repostsCount and emits kafka event")
    void repost_Success() {
        Post original = Post.builder()
                .id(1L)
                .authorId(200L)
                .authorUsername("other")
                .repostsCount(0)
                .build();

        Post savedRepost = Post.builder()
                .id(2L)
                .authorId(100L)
                .authorUsername("idan")
                .isRepost(true)
                .originalPostId(1L)
                .quoteComment("Nice post!")
                .visibility("PUBLIC")
                .createdAt(LocalDateTime.now())
                .build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(original));
        when(postRepository.save(any(Post.class))).thenReturn(original).thenReturn(savedRepost);

        RepostRequest req = RepostRequest.builder().quoteComment("Nice post!").build();
        PostResponseDto result = postService.repost(1L, req, testUser);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(2L);
        assertThat(original.getRepostsCount()).isEqualTo(1);
        verify(postKafkaProducer, times(1)).emitPostReposted(any(PostRepostedEvent.class));
    }

    @Test
    @DisplayName("votePoll throws exception if user already voted")
    void votePoll_AlreadyVoted_Throws() {
        Poll poll = Poll.builder()
                .id(10L)
                .expiresAt(LocalDateTime.now().plusHours(10))
                .build();

        when(pollRepository.findByPostId(1L)).thenReturn(Optional.of(poll));
        when(pollVoteRepository.existsByPollIdAndUserId(10L, 100L)).thenReturn(true);

        assertThatThrownBy(() -> postService.votePoll(1L, 5L, testUser))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("User already voted");
    }

    @Test
    @DisplayName("togglePin throws exception if user is not author")
    void togglePin_Unauthorized_Throws() {
        Post post = Post.builder()
                .id(1L)
                .authorId(999L)
                .build();

        when(postRepository.findById(1L)).thenReturn(Optional.of(post));

        assertThatThrownBy(() -> postService.togglePin(1L, testUser))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unauthorized: You can only pin your own posts");
    }
}
