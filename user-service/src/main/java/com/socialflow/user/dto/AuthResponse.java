package com.socialflow.user.dto;

public class AuthResponse {

    private String token;
    private String refreshToken;
    private Long userId;
    private String username;
    private String email;
    private String role;

    public AuthResponse() {}

    public AuthResponse(String token, Long userId, String username, String email) {
        this(token, null, userId, username, email, null);
    }

    public AuthResponse(String token, String refreshToken, Long userId, String username, String email, String role) {
        this.token = token;
        this.refreshToken = refreshToken;
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.role = role;
    }

    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }

    public String getRefreshToken() { return refreshToken; }
    public void setRefreshToken(String refreshToken) { this.refreshToken = refreshToken; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }
}