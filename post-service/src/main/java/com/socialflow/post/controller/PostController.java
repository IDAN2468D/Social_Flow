package com.socialflow.post.controller;

import com.socialflow.post.config.UserPrincipal;
import com.socialflow.post.dto.*;
import com.socialflow.post.model.ReactionType;
import com.socialflow.post.service.PostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/v1/posts", "/api/posts"})
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @PostMapping
    public ResponseEntity<PostResponseDto> createPost(
            @Valid @RequestBody CreatePostRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(postService.createPost(request, currentUser));
    }

    @PostMapping("/{id}/repost")
    public ResponseEntity<PostResponseDto> repost(
            @PathVariable Long id,
            @RequestBody(required = false) RepostRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(postService.repost(id, request, currentUser));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PostResponseDto> getPost(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long currentUserId = currentUser != null ? currentUser.getUserId() : null;
        return ResponseEntity.ok(postService.getPostById(id, currentUserId));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<Page<PostResponseDto>> getUserPosts(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        Long currentUserId = currentUser != null ? currentUser.getUserId() : null;
        return ResponseEntity.ok(postService.getUserPosts(userId, page, size, currentUserId));
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<Map<String, Object>> toggleLike(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        boolean liked = postService.toggleLike(id, currentUser);
        return ResponseEntity.ok(Map.of("postId", id, "liked", liked));
    }

    @PostMapping("/{id}/reactions")
    public ResponseEntity<ReactionSummaryDto> addReaction(
            @PathVariable Long id,
            @Valid @RequestBody ReactionRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(postService.addOrUpdateReaction(id, request.getReactionType(), currentUser));
    }

    @GetMapping("/{id}/reactions/summary")
    public ResponseEntity<ReactionSummaryDto> getReactionSummary(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        ReactionType userReaction = null;
        if (currentUser != null) {
            userReaction = postService.getReactionSummary(id, null).getUserReaction();
        }
        return ResponseEntity.ok(postService.getReactionSummary(id, userReaction));
    }

    @PostMapping("/{id}/bookmark")
    public ResponseEntity<Map<String, Object>> toggleBookmark(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        boolean bookmarked = postService.toggleBookmark(id, currentUser);
        return ResponseEntity.ok(Map.of("postId", id, "bookmarked", bookmarked));
    }

    @GetMapping("/bookmarks")
    public ResponseEntity<Page<PostResponseDto>> getBookmarkedPosts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(postService.getBookmarkedPosts(page, size, currentUser));
    }

    @PutMapping("/{id}/pin")
    public ResponseEntity<Map<String, Object>> togglePin(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        boolean pinned = postService.togglePin(id, currentUser);
        return ResponseEntity.ok(Map.of("postId", id, "pinned", pinned));
    }

    @PostMapping("/{id}/poll/vote")
    public ResponseEntity<PollResponseDto> votePoll(
            @PathVariable Long id,
            @RequestParam Long optionId,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(postService.votePoll(id, optionId, currentUser));
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<CommentResponseDto> addComment(
            @PathVariable Long id,
            @Valid @RequestBody CommentRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.status(HttpStatus.CREATED).body(postService.addComment(id, request, currentUser));
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<List<CommentResponseDto>> getComments(@PathVariable Long id) {
        return ResponseEntity.ok(postService.getComments(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, String>> deletePost(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal currentUser) {
        postService.deletePost(id, currentUser);
        return ResponseEntity.ok(Map.of("message", "Post deleted successfully", "postId", id.toString()));
    }
}