package com.socialflow.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;

@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    @Value("${jwt.secret:404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970}")
    private String secretKey;

    private static final List<String> PUBLIC_PATH_PREFIXES = List.of(
            "/api/auth/",
            "/actuator/",
            "/v3/api-docs",
            "/swagger-ui",
            "/swagger-resources",
            "/webjars",
            "/ws/",
            "/api/v1/ai/health"
    );

    private static final List<String> PUBLIC_GET_PREFIXES = List.of(
            "/api/v1/stories",
            "/api/stories",
            "/api/v1/search",
            "/api/search",
            "/api/v1/feed/trending",
            "/api/feed/trending",
            "/api/v1/feed/trending-tags",
            "/api/feed/trending-tags",
            "/api/v1/feed/for-you",
            "/api/feed/for-you",
            "/api/v1/feed/search",
            "/api/feed/search",
            "/api/v1/feed/user/",
            "/api/feed/user/",
            "/api/v1/users/profile",
            "/api/users/profile",
            "/api/v1/users/search",
            "/api/users/search"
    );

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();
        HttpMethod method = request.getMethod();

        // 1. Allow CORS pre-flight requests
        if (method == HttpMethod.OPTIONS) {
            return chain.filter(exchange);
        }

        boolean isPublic = isPublicRequest(method, path);

        // 2. Extract JWT Token from Authorization header or HttpOnly Cookie
        String token = extractToken(request);

        if (token == null || token.isBlank()) {
            if (isPublic) {
                return chain.filter(exchange);
            }
            log.warn("Unauthorized access attempt to {}: Missing JWT token", path);
            return onError(exchange, HttpStatus.UNAUTHORIZED, "Missing JWT authentication token or cookie");
        }

        // 3. Validate and Parse Claims (also attach identity headers on public GETs when a valid token is present)
        try {
            Claims claims = parseClaims(token);
            String username = claims.getSubject();
            Object userIdObj = claims.get("userId");
            Object emailObj = claims.get("email");

            String userIdStr = userIdObj != null ? String.valueOf(userIdObj) : "1";
            String emailStr = emailObj != null ? String.valueOf(emailObj) : "";

            // 4. Mutate Request and Forward Identity Headers to downstream microservices
            ServerHttpRequest mutatedRequest = request.mutate()
                    .header("X-User-Id", userIdStr)
                    .header("X-Auth-UserId", userIdStr)
                    .header("X-User-Email", emailStr)
                    .header("X-User-Name", username)
                    .header("X-Auth-Username", username)
                    .build();

            return chain.filter(exchange.mutate().request(mutatedRequest).build());

        } catch (Exception e) {
            if (isPublic) {
                log.debug("Ignoring invalid/expired JWT token on public path {}: {}", path, e.getMessage());
                return chain.filter(exchange);
            }
            log.error("Invalid JWT token for path {}: {}", path, e.getMessage());
            return onError(exchange, HttpStatus.UNAUTHORIZED, "Invalid or expired JWT token: " + e.getMessage());
        }
    }

    private boolean isPublicRequest(HttpMethod method, String path) {
        if (matchesAnyPrefix(path, PUBLIC_PATH_PREFIXES)) {
            return true;
        }
        return method == HttpMethod.GET && matchesAnyPrefix(path, PUBLIC_GET_PREFIXES);
    }

    private boolean matchesAnyPrefix(String path, List<String> prefixes) {
        for (String prefix : prefixes) {
            String normalized = prefix.replaceAll("/+$", "");
            if (prefix.endsWith("/")) {
                if (path.startsWith(prefix) || path.equals(normalized)) {
                    return true;
                }
            } else if (path.equals(normalized) || path.startsWith(normalized + "/")) {
                return true;
            }
        }
        return false;
    }

    private String extractToken(ServerHttpRequest request) {
        // A. Check Authorization: Bearer <token>
        String authHeader = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
        }

        // B. Check HttpOnly Cookies (jwt, token, access_token, AUTH-TOKEN)
        for (String cookieName : List.of("jwt", "token", "access_token", "AUTH-TOKEN")) {
            HttpCookie cookie = request.getCookies().getFirst(cookieName);
            if (cookie != null && !cookie.getValue().isBlank()) {
                return cookie.getValue().trim();
            }
        }

        return null;
    }

    private Claims parseClaims(String token) {
        SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secretKey));
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private Mono<Void> onError(ServerWebExchange exchange, HttpStatus status, String message) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(status);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);

        String path = exchange.getRequest().getURI().getPath();
        String jsonError = String.format(
                "{\"timestamp\":\"%s\",\"status\":%d,\"error\":\"%s\",\"message\":\"%s\",\"path\":\"%s\"}",
                Instant.now().toString(),
                status.value(),
                status.getReasonPhrase(),
                message.replace("\"", "'"),
                path
        );

        DataBuffer buffer = response.bufferFactory().wrap(jsonError.getBytes(StandardCharsets.UTF_8));
        return response.writeWith(Mono.just(buffer));
    }

    @Override
    public int getOrder() {
        return -100; // High precedence before routing filters
    }
}
