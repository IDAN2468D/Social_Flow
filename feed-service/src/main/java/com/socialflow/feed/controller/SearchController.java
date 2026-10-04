package com.socialflow.feed.controller;

import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.service.FeedService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/api/v1/search", "/api/search"})
@RequiredArgsConstructor
public class SearchController {

    private final FeedService feedService;

    @GetMapping
    public ResponseEntity<Page<PostDocument>> search(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(feedService.searchPosts(q, page, size));
    }

    @GetMapping("/tag/{tag}")
    public ResponseEntity<Page<PostDocument>> searchByTag(
            @PathVariable String tag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return ResponseEntity.ok(feedService.searchByTag(tag, page, size));
    }
}
