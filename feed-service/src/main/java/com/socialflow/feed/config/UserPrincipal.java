package com.socialflow.feed.config;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.security.Principal;

@Getter
@AllArgsConstructor
public class UserPrincipal implements Principal {
    private final Long userId;
    private final String username;
    private final String role;

    public UserPrincipal(Long userId, String username) {
        this(userId, username, "USER");
    }

    @Override
    public String getName() {
        return username;
    }
}