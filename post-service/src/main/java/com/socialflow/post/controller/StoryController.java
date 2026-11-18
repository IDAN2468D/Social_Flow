package com.socialflow.post.controller;

import com.socialflow.post.config.UserPrincipal;
import com.socialflow.post.dto.CreateStoryRequest;
import com.socialflow.post.dto.StoryResponseDto;
import com.socialflow.post.service.StoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping({"/api/v1/stories", "/api/stories"})
@RequiredArgsConstructor
public class StoryController {

    private final StoryService storyService;

    @GetMapping
    public ResponseEntity<List<StoryResponseDto>> getActiveStories() {
        return ResponseEntity.ok(storyService.getActiveStories());
    }

    @PostMapping
    public ResponseEntity<StoryResponseDto> createStory(
            @Valid @RequestBody CreateStoryRequest request,
            @AuthenticationPrincipal UserPrincipal currentUser,
            @RequestHeader(value = "X-Auth-UserId", required = false) String headerUserId,
            @RequestHeader(value = "X-Auth-Username", required = false) String headerUsername) {
        Long userId = currentUser != null ? currentUser.getUserId() : null;
        String username = currentUser != null ? currentUser.getUsername() : null;

        if (userId == null && headerUserId != null && !headerUserId.isBlank()) {
            try {
                userId = Long.parseLong(headerUserId.trim());
            } catch (NumberFormatException ignored) {
            }
        }
        if ((username == null || username.isBlank()) && headerUsername != null && !headerUsername.isBlank()) {
            username = headerUsername.trim();
        }
        if (userId == null || username == null || username.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(storyService.createStory(request, userId, username));
    }
}
