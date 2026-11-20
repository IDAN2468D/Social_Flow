package com.socialflow.user.controller;

import com.socialflow.user.dto.AuthResponse;
import com.socialflow.user.dto.LoginRequest;
import com.socialflow.user.dto.RefreshTokenRequest;
import com.socialflow.user.dto.RegisterRequest;
import com.socialflow.user.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private static final String ACCESS_COOKIE_NAME = "jwt";
    private static final String REFRESH_COOKIE_NAME = "refresh_token";

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        return buildAuthResponse(HttpStatus.CREATED, response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        return buildAuthResponse(HttpStatus.OK, response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @RequestBody(required = false) RefreshTokenRequest request,
            @CookieValue(name = REFRESH_COOKIE_NAME, required = false) String refreshCookie) {
        String rawRefreshToken = resolveRefreshToken(request, refreshCookie);
        AuthResponse response = authService.refresh(rawRefreshToken);
        return buildAuthResponse(HttpStatus.OK, response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            @RequestBody(required = false) RefreshTokenRequest request,
            @CookieValue(name = REFRESH_COOKIE_NAME, required = false) String refreshCookie,
            @CookieValue(name = ACCESS_COOKIE_NAME, required = false) String jwtCookie,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authHeader,
            @RequestParam(value = "all", defaultValue = "false") boolean allSessions) {
        String rawRefreshToken = resolveRefreshToken(request, refreshCookie);
        String accessToken = resolveAccessToken(authHeader, jwtCookie);
        authService.logout(rawRefreshToken, accessToken, allSessions);

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.SET_COOKIE, clearCookie(ACCESS_COOKIE_NAME, "/").toString());
        headers.add(HttpHeaders.SET_COOKIE, clearCookie(REFRESH_COOKIE_NAME, "/api/auth").toString());

        return ResponseEntity.ok()
                .headers(headers)
                .body(Map.of("message", "Logged out successfully"));
    }

    private ResponseEntity<AuthResponse> buildAuthResponse(HttpStatus status, AuthResponse response) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.SET_COOKIE, buildJwtCookie(response.getToken()).toString());
        if (response.getRefreshToken() != null && !response.getRefreshToken().isBlank()) {
            headers.add(HttpHeaders.SET_COOKIE, buildRefreshCookie(response.getRefreshToken()).toString());
        }
        return ResponseEntity.status(status)
                .headers(headers)
                .body(response);
    }

    private String resolveRefreshToken(RefreshTokenRequest request, String refreshCookie) {
        if (request != null && request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            return request.getRefreshToken().trim();
        }
        if (refreshCookie != null && !refreshCookie.isBlank()) {
            return refreshCookie.trim();
        }
        return null;
    }

    private String resolveAccessToken(String authHeader, String jwtCookie) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
        }
        if (jwtCookie != null && !jwtCookie.isBlank()) {
            return jwtCookie.trim();
        }
        return null;
    }

    private ResponseCookie buildJwtCookie(String token) {
        return ResponseCookie.from(ACCESS_COOKIE_NAME, token)
                .httpOnly(true)
                .secure(false) // Set to true in production with HTTPS
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofDays(1))
                .build();
    }

    private ResponseCookie buildRefreshCookie(String refreshToken) {
        return ResponseCookie.from(REFRESH_COOKIE_NAME, refreshToken)
                .httpOnly(true)
                .secure(false) // Set to true in production with HTTPS
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(Duration.ofMillis(authService.getRefreshExpirationMs()))
                .build();
    }

    private ResponseCookie clearCookie(String name, String path) {
        return ResponseCookie.from(name, "")
                .httpOnly(true)
                .secure(false)
                .sameSite("Lax")
                .path(path)
                .maxAge(Duration.ZERO)
                .build();
    }
}
