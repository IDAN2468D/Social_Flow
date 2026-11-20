package com.socialflow.media.config;

import java.security.Principal;

public class UserPrincipal implements Principal {

    private final Long userId;
    private final String username;
    private final String role;

    public UserPrincipal(Long userId, String username, String role) {
        this.userId = userId;
        this.username = username;
        this.role = (role != null && !role.isBlank()) ? role : "USER";
    }

    public UserPrincipal(Long userId, String username) {
        this(userId, username, "USER");
    }

    public Long getUserId() {
        return userId;
    }

    public String getUsername() {
        return username;
    }

    public String getRole() {
        return role;
    }

    @Override
    public String getName() {
        return username;
    }
}
