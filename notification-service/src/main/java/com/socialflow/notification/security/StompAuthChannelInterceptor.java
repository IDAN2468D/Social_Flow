package com.socialflow.notification.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.security.Principal;
import java.util.Date;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Pattern USER_TOPIC_PATTERN = Pattern.compile("^/topic/user\\.([^./]+)(?:\\..+)?$");

    private final String secretKey;

    public StompAuthChannelInterceptor(
            @Value("${jwt.secret:404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970}") String secretKey) {
        this.secretKey = secretKey;
    }

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null || accessor.getCommand() == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();
        if (StompCommand.CONNECT.equals(command)) {
            handleConnect(accessor);
        } else if (StompCommand.SUBSCRIBE.equals(command)) {
            handleSubscribe(accessor);
        } else if (StompCommand.SEND.equals(command)) {
            if (extractPrincipal(accessor.getUser()) == null) {
                throw new AccessDeniedException("Authentication required to send STOMP messages");
            }
        }

        return message;
    }

    private void handleConnect(StompHeaderAccessor accessor) {
        String jwt = extractJwt(accessor);
        if (jwt == null || jwt.isBlank()) {
            log.warn("Rejected unauthenticated STOMP CONNECT: missing JWT token");
            throw new AccessDeniedException("Missing JWT token for WebSocket STOMP connection");
        }

        try {
            SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretKey));
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(jwt).getPayload();

            if (claims.getExpiration() == null || !claims.getExpiration().after(new Date())) {
                throw new AccessDeniedException("Expired JWT token for WebSocket STOMP connection");
            }

            String username = claims.getSubject();
            Long userId = extractLongClaim(claims.get("userId"));
            if (username == null || username.isBlank() || userId == null) {
                throw new AccessDeniedException("JWT token missing required identity claims");
            }

            String role = normalizeRole(claims.get("role") != null ? String.valueOf(claims.get("role")) : null);
            UserPrincipal principal = new UserPrincipal(userId, username, role);
            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    principal,
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + role))
            );
            accessor.setUser(authentication);
        } catch (AccessDeniedException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("Rejected STOMP CONNECT due to invalid JWT: {}", ex.getMessage());
            throw new AccessDeniedException("Invalid JWT token for WebSocket STOMP connection", ex);
        }
    }

    private void handleSubscribe(StompHeaderAccessor accessor) {
        UserPrincipal principal = extractPrincipal(accessor.getUser());
        if (principal == null || principal.getUserId() == null) {
            log.warn("Rejected unauthenticated STOMP SUBSCRIBE to {}", accessor.getDestination());
            throw new AccessDeniedException("Authentication required to subscribe to notifications");
        }

        String destination = accessor.getDestination();
        if (destination == null || destination.isBlank()) {
            throw new AccessDeniedException("STOMP subscription destination is required");
        }

        boolean isAdmin = "ADMIN".equalsIgnoreCase(principal.getRole());

        // Block wildcard broker subscriptions for non-ADMIN users
        if (!isAdmin && (destination.contains("*") || destination.contains("#"))) {
            log.warn("User {} denied wildcard STOMP subscription to {}", principal.getUserId(), destination);
            throw new AccessDeniedException("Wildcard STOMP subscriptions are not permitted");
        }

        Matcher matcher = USER_TOPIC_PATTERN.matcher(destination.trim());
        if (matcher.matches()) {
            String targetIdSegment = matcher.group(1);
            Long targetUserId;
            try {
                targetUserId = Long.parseLong(targetIdSegment);
            } catch (NumberFormatException ex) {
                throw new AccessDeniedException("Invalid user notification channel: " + destination);
            }

            if (!isAdmin && !principal.getUserId().equals(targetUserId)) {
                log.warn("User {} attempted unauthorized STOMP subscription to {}", principal.getUserId(), destination);
                throw new AccessDeniedException("Not authorized to subscribe to another user's notification channel");
            }
        }
    }

    private String extractJwt(StompHeaderAccessor accessor) {
        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (authHeader == null) {
            authHeader = accessor.getFirstNativeHeader("authorization");
        }
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
        }
        String tokenHeader = accessor.getFirstNativeHeader("token");
        if (tokenHeader != null && !tokenHeader.isBlank()) {
            return tokenHeader.trim();
        }
        return null;
    }

    private UserPrincipal extractPrincipal(Principal user) {
        if (user instanceof UserPrincipal up) {
            return up;
        }
        if (user instanceof Authentication auth && auth.getPrincipal() instanceof UserPrincipal up) {
            return up;
        }
        return null;
    }

    private Long extractLongClaim(Object claim) {
        if (claim instanceof Number number) {
            return number.longValue();
        }
        if (claim instanceof String text && !text.isBlank()) {
            try {
                return Long.parseLong(text.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private String normalizeRole(String rawRole) {
        if (rawRole == null || rawRole.isBlank()) {
            return "USER";
        }
        String trimmed = rawRole.trim().toUpperCase();
        return trimmed.startsWith("ROLE_") ? trimmed.substring(5) : trimmed;
    }
}
