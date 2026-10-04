package com.socialflow.feed.controller;

import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.dto.TrendingTagDto;
import com.socialflow.feed.service.FeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/v1/feed", "/api/feed"})
@RequiredArgsConstructor
public class FeedController {

    private final FeedService feedService;

    @GetMapping("/following")
    public ResponseEntity<Page<PostDocument>> getFollowingFeed(
            @RequestParam(defaultValue = "1") Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(feedService.getFollowingFeed(userId, page, size));
    }

    @GetMapping("/for-you")
    public ResponseEntity<Page<PostDocument>> getForYouFeed(
            @RequestParam(required = false) Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(feedService.getForYouFeed(userId, page, size));
    }

    @GetMapping("/trending")
    public ResponseEntity<Page<PostDocument>> getTrendingFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(feedService.getTrendingFeed(page, size));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<Page<PostDocument>> getUserProfileFeed(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(feedService.getUserProfileFeed(userId, page, size));
    }

    @GetMapping("/trending-tags")
    public ResponseEntity<List<TrendingTagDto>> getTrendingTags(
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(feedService.getTrendingHashtags(limit));
    }

    @GetMapping("/search")
    public ResponseEntity<Page<PostDocument>> searchPosts(
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(feedService.searchPosts(query, page, size));
    }

    @GetMapping("/search/tag")
    public ResponseEntity<Page<PostDocument>> searchByTag(
            @RequestParam String tag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(feedService.searchByTag(tag, page, size));
    }
}