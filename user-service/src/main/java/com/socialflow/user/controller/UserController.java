package com.socialflow.user.controller;

import com.socialflow.user.dto.UpdateProfileRequest;
import com.socialflow.user.dto.UserProfileDto;
import com.socialflow.user.service.UserService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/v1/users", "/api/users"})
@CrossOrigin(origins = "*")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping({"/profile", "/profile/{username}"})
    public ResponseEntity<UserProfileDto> getProfile(
            @PathVariable(required = false) String username,
            Authentication authentication,
            @RequestHeader(value = "X-Auth-Username", required = false) String authUsernameHeader,
            @RequestHeader(value = "X-User-Name", required = false) String userNameHeader) {
        String currentUsername = resolveActingUsername(authentication, authUsernameHeader, userNameHeader);
        String targetUsername = (username != null && !username.isBlank())
                ? username
                : requireActingUsername(authentication, authUsernameHeader, userNameHeader);
        UserProfileDto profile = userService.getProfile(targetUsername, currentUsername);
        return ResponseEntity.ok(profile);
    }

    @PutMapping({"/profile", "/profile/{username}"})
    public ResponseEntity<UserProfileDto> updateProfile(
            @PathVariable(required = false) String username,
            @Valid @RequestBody UpdateProfileRequest request,
            Authentication authentication,
            @RequestHeader(value = "X-Auth-Username", required = false) String authUsernameHeader,
            @RequestHeader(value = "X-User-Name", required = false) String userNameHeader) {
        String actingUsername = requireActingUsername(authentication, authUsernameHeader, userNameHeader);
        if (username != null && !username.isBlank() && !username.equalsIgnoreCase(actingUsername)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "אין הרשאה לעדכן פרופיל של משתמש אחר");
        }
        UserProfileDto updated = userService.updateProfile(actingUsername, request);
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/search")
    public ResponseEntity<List<UserProfileDto>> searchUsers(
            @RequestParam(required = false, defaultValue = "") String q,
            Authentication authentication,
            @RequestHeader(value = "X-Auth-Username", required = false) String authUsernameHeader,
            @RequestHeader(value = "X-User-Name", required = false) String userNameHeader) {
        String currentUsername = resolveActingUsername(authentication, authUsernameHeader, userNameHeader);
        return ResponseEntity.ok(userService.searchUsers(q, currentUsername));
    }

    @PostMapping("/{targetIdentifier}/follow")
    public ResponseEntity<Map<String, String>> followUser(
            @PathVariable String targetIdentifier,
            Authentication authentication,
            @RequestHeader(value = "X-Auth-Username", required = false) String authUsernameHeader,
            @RequestHeader(value = "X-User-Name", required = false) String userNameHeader) {
        String actingUsername = requireActingUsername(authentication, authUsernameHeader, userNameHeader);
        userService.followUser(targetIdentifier, actingUsername);
        return ResponseEntity.ok(Map.of("message", "עוקב בהצלחה אחרי משתמש " + targetIdentifier));
    }

    @DeleteMapping({"/{targetIdentifier}/follow", "/{targetIdentifier}/unfollow"})
    public ResponseEntity<Map<String, String>> unfollowUser(
            @PathVariable String targetIdentifier,
            Authentication authentication,
            @RequestHeader(value = "X-Auth-Username", required = false) String authUsernameHeader,
            @RequestHeader(value = "X-User-Name", required = false) String userNameHeader) {
        String actingUsername = requireActingUsername(authentication, authUsernameHeader, userNameHeader);
        userService.unfollowUser(targetIdentifier, actingUsername);
        return ResponseEntity.ok(Map.of("message", "המעקב בוטל בהצלחה"));
    }

    @GetMapping("/{userId}/following-ids")
    public ResponseEntity<List<Long>> getFollowingIds(@PathVariable Long userId) {
        List<Long> ids = userService.getFollowingIds(userId);
        return ResponseEntity.ok(ids);
    }

    private String resolveActingUsername(
            Authentication authentication,
            String authUsernameHeader,
            String userNameHeader) {
        if (authentication != null
                && !(authentication instanceof AnonymousAuthenticationToken)
                && authentication.getName() != null
                && !authentication.getName().isBlank()
                && !"anonymousUser".equals(authentication.getName())) {
            return authentication.getName().trim();
        }
        if (authUsernameHeader != null && !authUsernameHeader.isBlank()) {
            return authUsernameHeader.trim();
        }
        if (userNameHeader != null && !userNameHeader.isBlank()) {
            return userNameHeader.trim();
        }
        return null;
    }

    private String requireActingUsername(
            Authentication authentication,
            String authUsernameHeader,
            String userNameHeader) {
        String username = resolveActingUsername(authentication, authUsernameHeader, userNameHeader);
        if (username == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "נדרשת התחברות לביצוע פעולה זו");
        }
        return username;
    }
}