package com.socialflow.user.controller;

import com.socialflow.user.dto.UserProfileDto;
import com.socialflow.user.service.UserService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/users")
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/profile/{username}")
    public ResponseEntity<UserProfileDto> getProfile(@PathVariable String username, Authentication authentication) {
        String currentUsername = (authentication != null) ? authentication.getName() : null;
        UserProfileDto profile = userService.getProfile(username, currentUsername);
        return ResponseEntity.ok(profile);
    }

    @PostMapping("/{targetUserId}/follow")
    public ResponseEntity<Map<String, String>> followUser(@PathVariable Long targetUserId, Authentication authentication) {
        userService.followUser(targetUserId, authentication.getName());
        return ResponseEntity.ok(Map.of("message", "עוקב בהצלחה אחרי משתמש " + targetUserId));
    }

    @DeleteMapping("/{targetUserId}/unfollow")
    public ResponseEntity<Map<String, String>> unfollowUser(@PathVariable Long targetUserId, Authentication authentication) {
        userService.unfollowUser(targetUserId, authentication.getName());
        return ResponseEntity.ok(Map.of("message", "המעקב בוטל בהצלחה"));
    }

    @GetMapping("/{userId}/following-ids")
    public ResponseEntity<List<Long>> getFollowingIds(@PathVariable Long userId) {
        List<Long> ids = userService.getFollowingIds(userId);
        return ResponseEntity.ok(ids);
    }
}