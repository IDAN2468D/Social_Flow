package com.socialflow.media.controller;

import com.socialflow.media.dto.UploadUrlRequest;
import com.socialflow.media.dto.UploadUrlResponse;
import com.socialflow.media.service.MediaService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.crypto.SecretKey;
import java.util.Map;

@RestController
@RequestMapping({"/api/v1/media", "/api/media"})
public class MediaController {

    private static final Logger log = LoggerFactory.getLogger(MediaController.class);
    private final MediaService mediaService;
    private final String jwtSecret;

    public MediaController(MediaService mediaService,
                           @Value("${jwt.secret:404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970}") String jwtSecret) {
        this.mediaService = mediaService;
        this.jwtSecret = jwtSecret;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        return ResponseEntity.ok(Map.of("status", "UP", "service", "media-service"));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> listMyMedia(
            @RequestParam(value = "all", defaultValue = "false") boolean all,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestHeader(value = "X-Auth-UserId", required = false) String gatewayUserId,
            @RequestHeader(value = "X-User-Role", required = false) String gatewayRole,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        Long userId = resolveUserId(headerUserId, gatewayUserId, authHeader);
        boolean isAdmin = resolveIsAdmin(gatewayRole, authHeader);
        return ResponseEntity.ok(mediaService.listUserMedia(userId, all, isAdmin));
    }

    @PostMapping({"/upload-url", "/presign"})
    public ResponseEntity<UploadUrlResponse> getUploadUrl(
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestHeader(value = "X-Auth-UserId", required = false) String gatewayUserId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @Valid @RequestBody UploadUrlRequest request
    ) {
        Long userId = resolveUserId(headerUserId, gatewayUserId, authHeader);
        UploadUrlResponse response = mediaService.generateUploadUrl(userId, request);
        return ResponseEntity.ok(response);
    }

    @DeleteMapping
    public ResponseEntity<Void> deleteMedia(
            @RequestParam("key") String key,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId,
            @RequestHeader(value = "X-Auth-UserId", required = false) String gatewayUserId,
            @RequestHeader(value = "X-User-Role", required = false) String gatewayRole,
            @RequestHeader(value = "Authorization", required = false) String authHeader
    ) {
        Long userId = resolveUserId(headerUserId, gatewayUserId, authHeader);
        boolean isAdmin = resolveIsAdmin(gatewayRole, authHeader);
        mediaService.deleteMedia(userId, isAdmin, key);
        return ResponseEntity.noContent().build();
    }

    private boolean resolveIsAdmin(String gatewayRole, String authHeader) {
        if (gatewayRole != null && gatewayRole.trim().equalsIgnoreCase("ADMIN")) {
            return true;
        }
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            try {
                String token = authHeader.substring(7);
                SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(jwtSecret));
                Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
                Object roleObj = claims.get("role");
                if (roleObj != null) {
                    String role = String.valueOf(roleObj).trim().toUpperCase();
                    return "ADMIN".equals(role) || "ROLE_ADMIN".equals(role);
                }
            } catch (Exception ignored) {}
        }
        return false;
    }

    private Long resolveUserId(Long headerUserId, String gatewayUserId, String authHeader) {
        if (headerUserId != null) {
            return headerUserId;
        }
        if (gatewayUserId != null && !gatewayUserId.isBlank()) {
            try {
                return Long.parseLong(gatewayUserId);
            } catch (NumberFormatException ignored) {}
        }
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            try {
                String token = authHeader.substring(7);
                SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(jwtSecret));
                Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
                Object userIdObj = claims.get("userId");
                if (userIdObj instanceof Number) {
                    return ((Number) userIdObj).longValue();
                }
            } catch (Exception e) {
                log.debug("Could not parse JWT token: {}", e.getMessage());
            }
        }
        return 1L; // Fallback default user ID
    }
}