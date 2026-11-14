package com.socialflow.user.controller;

import com.socialflow.user.dto.AuthResponse;
import com.socialflow.user.dto.LoginRequest;
import com.socialflow.user.dto.RegisterRequest;
import com.socialflow.user.service.AuthService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = "*")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthResponse response = authService.register(request);
        ResponseCookie cookie = buildJwtCookie(response.getToken());
        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(response);
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthResponse response = authService.login(request);
        ResponseCookie cookie = buildJwtCookie(response.getToken());
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(response);
    }

    private ResponseCookie buildJwtCookie(String token) {
        return ResponseCookie.from("jwt", token)
                .httpOnly(true)
                .secure(false) // Set to true in production with HTTPS
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofDays(1))
                .build();
    }
}
