package com.socialflow.feed.controller;

import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.service.FeedKafkaProducer;
import com.socialflow.feed.service.FeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping({"/api/v1/search", "/api/search"})
@RequiredArgsConstructor
public class SearchController {

    private final FeedService feedService;

    @Autowired(required = false)
    private FeedKafkaProducer feedKafkaProducer;

    @GetMapping
    public ResponseEntity<Page<PostDocument>> search(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        String effectiveQuery = !q.isBlank() ? q : query;
        Page<PostDocument> result = feedService.searchPosts(effectiveQuery, page, size);
        if (feedKafkaProducer != null) {
            feedKafkaProducer.emitFeedEvent("FEED_SEARCHED", "search:" + effectiveQuery, Map.of(
                    "query", effectiveQuery, "page", page, "size", size, "resultsCount", result.getNumberOfElements()
            ));
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/multi")
    public ResponseEntity<Map<String, Object>> searchMulti(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        String effectiveQuery = !q.isBlank() ? q : query;
        Map<String, Object> result = feedService.searchMulti(effectiveQuery, page, size);
        if (feedKafkaProducer != null) {
            feedKafkaProducer.emitFeedEvent("FEED_MULTI_SEARCHED", "multi:" + effectiveQuery, Map.of(
                    "query", effectiveQuery, "page", page, "size", size
            ));
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/tag/{tag}")
    public ResponseEntity<Page<PostDocument>> searchByTag(
            @PathVariable String tag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Page<PostDocument> result = feedService.searchByTag(tag, page, size);
        if (feedKafkaProducer != null) {
            feedKafkaProducer.emitFeedEvent("FEED_TAG_SEARCHED", "tag:" + tag, Map.of(
                    "tag", tag, "page", page, "size", size, "resultsCount", result.getNumberOfElements()
            ));
        }
        return ResponseEntity.ok(result);
    }
}
