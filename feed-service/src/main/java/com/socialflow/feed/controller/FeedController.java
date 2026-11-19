package com.socialflow.feed.controller;

import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.dto.TrendingTagDto;
import com.socialflow.feed.service.FeedKafkaProducer;
import com.socialflow.feed.service.FeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/v1/feed", "/api/feed"})
@RequiredArgsConstructor
public class FeedController {

    private final FeedService feedService;

    @Autowired(required = false)
    private FeedKafkaProducer feedKafkaProducer;

    @GetMapping("/following")
    public ResponseEntity<Page<PostDocument>> getFollowingFeed(
            @RequestParam(defaultValue = "1") Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<PostDocument> result = feedService.getFollowingFeed(userId, page, size);
        emitIfPresent("FEED_FOLLOWING_VIEWED", "user:" + userId, Map.of(
                "userId", userId, "feedType", "FOLLOWING", "page", page, "size", size, "resultsCount", result.getNumberOfElements()
        ));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/for-you")
    public ResponseEntity<Page<PostDocument>> getForYouFeed(
            @RequestParam(required = false) Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<PostDocument> result = feedService.getForYouFeed(userId, page, size);
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("userId", userId != null ? userId : 0L);
        details.put("feedType", "FOR_YOU");
        details.put("page", page);
        details.put("size", size);
        details.put("resultsCount", result.getNumberOfElements());
        emitIfPresent("FEED_FOR_YOU_VIEWED", "for-you:" + (userId != null ? userId : "guest"), details);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/trending")
    public ResponseEntity<Page<PostDocument>> getTrendingFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<PostDocument> result = feedService.getTrendingFeed(page, size);
        emitIfPresent("FEED_TRENDING_VIEWED", "trending", Map.of(
                "feedType", "TRENDING", "page", page, "size", size, "resultsCount", result.getNumberOfElements()
        ));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<Page<PostDocument>> getUserProfileFeed(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<PostDocument> result = feedService.getUserProfileFeed(userId, page, size);
        emitIfPresent("FEED_USER_PROFILE_VIEWED", "user:" + userId, Map.of(
                "userId", userId, "feedType", "USER_PROFILE", "page", page, "size", size, "resultsCount", result.getNumberOfElements()
        ));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/trending-tags")
    public ResponseEntity<List<TrendingTagDto>> getTrendingTags(
            @RequestParam(defaultValue = "10") int limit) {
        List<TrendingTagDto> result = feedService.getTrendingHashtags(limit);
        emitIfPresent("FEED_TRENDING_TAGS_VIEWED", "trending-tags", Map.of(
                "limit", limit, "tagsCount", result.size()
        ));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/search")
    public ResponseEntity<Page<PostDocument>> searchPosts(
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<PostDocument> result = feedService.searchPosts(query, page, size);
        emitIfPresent("FEED_SEARCHED", "search:" + query, Map.of(
                "query", query, "page", page, "size", size, "resultsCount", result.getNumberOfElements()
        ));
        return ResponseEntity.ok(result);
    }

    @GetMapping("/search/tag")
    public ResponseEntity<Page<PostDocument>> searchByTag(
            @RequestParam String tag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<PostDocument> result = feedService.searchByTag(tag, page, size);
        emitIfPresent("FEED_TAG_SEARCHED", "tag:" + tag, Map.of(
                "tag", tag, "page", page, "size", size, "resultsCount", result.getNumberOfElements()
        ));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/events")
    public ResponseEntity<Map<String, Object>> publishFeedEvent(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestHeader(value = "X-Auth-UserId", required = false) String authUserId,
            @RequestHeader(value = "X-Auth-Username", required = false) String authUsername) {
        Map<String, Object> details = new LinkedHashMap<>();
        if (body != null) {
            details.putAll(body);
        }
        String eventType = details.get("eventType") != null && !details.get("eventType").toString().isBlank()
                ? details.get("eventType").toString()
                : "FEED_REFRESHED";
        details.remove("eventType");
        if (authUserId != null && !details.containsKey("userId")) {
            details.put("userId", authUserId);
        }
        if (authUsername != null && !details.containsKey("username")) {
            details.put("username", authUsername);
        }
        String key = details.getOrDefault("feedType", "feed").toString();
        Map<String, Object> emitted = feedKafkaProducer != null
                ? feedKafkaProducer.emitFeedEvent(eventType, key, details)
                : details;
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "topic", "feed-events",
                "status", "PUBLISHED",
                "event", emitted
        ));
    }

    private void emitIfPresent(String eventType, String key, Map<String, Object> details) {
        if (feedKafkaProducer != null) {
            feedKafkaProducer.emitFeedEvent(eventType, key, details);
        }
    }
}