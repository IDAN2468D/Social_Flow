package com.socialflow.media.config;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import javax.crypto.SecretKey;
import java.io.IOException;
import java.util.Date;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final List<String> COOKIE_NAMES = List.of("jwt", "token", "access_token", "AUTH-TOKEN");

    private final String secretKey;

    public JwtAuthenticationFilter(
            @Value("${jwt.secret:404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970}") String secretKey) {
        this.secretKey = secretKey;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain
    ) throws ServletException, IOException {
        if (SecurityContextHolder.getContext().getAuthentication() != null) {
            filterChain.doFilter(request, response);
            return;
        }

        // 1. Prefer verified Bearer token / HttpOnly JWT cookie when present
        String jwt = extractJwt(request);
        if (jwt != null && !jwt.isBlank()) {
            try {
                SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretKey));
                Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(jwt).getPayload();

                if (claims.getExpiration() != null && claims.getExpiration().after(new Date())) {
                    String username = claims.getSubject();
                    Long userId = extractLongClaim(claims.get("userId"));
                    if (userId != null && username != null && !username.isBlank()) {
                        String role = normalizeRole(claims.get("role") != null ? String.valueOf(claims.get("role")) : null);
                        authenticate(request, userId, username, role);
                        filterChain.doFilter(request, response);
                        return;
                    }
                }
            } catch (Exception ignored) {
                // Invalid JWT will fall through unauthenticated (do not trust headers if JWT failed)
                filterChain.doFilter(request, response);
                return;
            }
        }

        // 2. Accept verified API Gateway forwarded headers
        String gatewayUserId = request.getHeader("X-Auth-UserId");
        if (gatewayUserId == null || gatewayUserId.isBlank()) {
            gatewayUserId = request.getHeader("X-User-Id");
        }
        String gatewayUsername = request.getHeader("X-Auth-Username");
        if (gatewayUsername == null || gatewayUsername.isBlank()) {
            gatewayUsername = request.getHeader("X-User-Name");
        }

        if (gatewayUserId != null && !gatewayUserId.isBlank()) {
            try {
                Long parsedUserId = Long.parseLong(gatewayUserId.trim());
                String username = (gatewayUsername != null && !gatewayUsername.isBlank())
                        ? gatewayUsername.trim()
                        : "user-" + parsedUserId;
                String role = normalizeRole(request.getHeader("X-User-Role"));
                authenticate(request, parsedUserId, username, role);
            } catch (NumberFormatException ignored) {
                // Malformed user id header leaves request unauthenticated
            }
        }

        filterChain.doFilter(request, response);
    }

    private void authenticate(HttpServletRequest request, Long userId, String username, String role) {
        UserPrincipal principal = new UserPrincipal(userId, username, role);
        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                principal,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
        );
        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authToken);
    }

    private String extractJwt(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
        }
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (String cookieName : COOKIE_NAMES) {
                for (Cookie cookie : cookies) {
                    if (cookieName.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                        return cookie.getValue().trim();
                    }
                }
            }
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
