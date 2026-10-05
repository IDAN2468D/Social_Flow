package com.socialflow.notification.security;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.security.Principal;

@Getter
@AllArgsConstructor
public class UserPrincipal implements Principal {
    private final Long userId;
    private final String username;

    @Override
    public String getName() {
        return username;
    }
}
