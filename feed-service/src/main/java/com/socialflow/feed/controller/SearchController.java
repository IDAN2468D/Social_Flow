package com.socialflow.feed.controller;

import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.dto.CursorPageResponse;
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

    public ResponseEntity<Page<PostDocument>> search(
            String q, String query, int page, int size) {
        return search(q, query, false, page, size);
    }

    @GetMapping
    public ResponseEntity<Page<PostDocument>> search(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(defaultValue = "false") boolean fuzzy,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        String effectiveQuery = !q.isBlank() ? q : query;
        Page<PostDocument> result = fuzzy
                ? feedService.searchPostsFuzzy(effectiveQuery, page, size)
                : feedService.searchPosts(effectiveQuery, page, size);
        if (feedKafkaProducer != null) {
            feedKafkaProducer.emitFeedEvent("FEED_SEARCHED", "search:" + effectiveQuery, Map.of(
                    "query", effectiveQuery, "fuzzy", fuzzy, "page", page, "size", size, "resultsCount", result.getNumberOfElements()
            ));
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/cursor")
    public ResponseEntity<CursorPageResponse<PostDocument>> searchCursor(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String author,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "true") boolean fuzzy,
            @RequestParam(required = false) String cursor,
            @RequestParam(defaultValue = "10") int size) {
        String effectiveQuery = !q.isBlank() ? q : query;
        return ResponseEntity.ok(
                feedService.searchPostsCursor(effectiveQuery, tag, author, category, fuzzy, cursor, size)
        );
    }

    @GetMapping("/suggest")
    public ResponseEntity<Map<String, Object>> suggest(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(defaultValue = "8") int limit) {
        String effectiveQuery = !q.isBlank() ? q : query;
        return ResponseEntity.ok(feedService.suggestSearch(effectiveQuery, limit));
    }

    @GetMapping("/facets")
    public ResponseEntity<Map<String, Object>> facets(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false, defaultValue = "") String query,
            @RequestParam(defaultValue = "10") int limit) {
        String effectiveQuery = !q.isBlank() ? q : query;
        return ResponseEntity.ok(feedService.getSearchFacets(effectiveQuery, limit));
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
