package com.socialflow.gateway;

import com.socialflow.gateway.filter.JwtAuthFilter;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpCookie;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.test.util.ReflectionTestUtils;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class JwtAuthFilterTest {

    @InjectMocks
    private JwtAuthFilter jwtAuthFilter;

    @Mock
    private GatewayFilterChain filterChain;

    private final String secret = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(jwtAuthFilter, "secretKey", secret);
        lenient().when(filterChain.filter(any())).thenReturn(Mono.empty());
    }

    private String generateTestToken(Long userId, String username, String email, long ttlMillis) {
        SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        return Jwts.builder()
                .claims(Map.of("userId", userId, "email", email))
                .subject(username)
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + ttlMillis))
                .signWith(key)
                .compact();
    }

    @Test
    void testPublicPathBypassesAuth() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/auth/login").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        jwtAuthFilter.filter(exchange, filterChain).block();

        verify(filterChain, times(1)).filter(any());
        assertNull(exchange.getResponse().getStatusCode());
    }

    @Test
    void testMissingTokenReturns401() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/posts").build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        jwtAuthFilter.filter(exchange, filterChain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        verify(filterChain, never()).filter(any());
    }

    @Test
    void testValidBearerTokenForwardsIdentityHeaders() {
        String token = generateTestToken(42L, "idan", "idan@example.com", 60000);
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/posts")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        jwtAuthFilter.filter(exchange, filterChain).block();

        verify(filterChain, times(1)).filter(argThat(ex -> {
            HttpHeaders headers = ex.getRequest().getHeaders();
            return "42".equals(headers.getFirst("X-User-Id")) &&
                   "42".equals(headers.getFirst("X-Auth-UserId")) &&
                   "idan".equals(headers.getFirst("X-Auth-Username")) &&
                   "idan@example.com".equals(headers.getFirst("X-User-Email"));
        }));
    }

    @Test
    void testValidHttpOnlyCookieForwardsIdentityHeaders() {
        String token = generateTestToken(99L, "noa", "noa@example.com", 60000);
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/feed")
                .cookie(new HttpCookie("jwt", token))
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        jwtAuthFilter.filter(exchange, filterChain).block();

        verify(filterChain, times(1)).filter(argThat(ex -> {
            HttpHeaders headers = ex.getRequest().getHeaders();
            return "99".equals(headers.getFirst("X-User-Id")) &&
                   "noa".equals(headers.getFirst("X-Auth-Username"));
        }));
    }

    @Test
    void testInvalidTokenReturns401() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/posts")
                .header(HttpHeaders.AUTHORIZATION, "Bearer invalid.token.value")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        jwtAuthFilter.filter(exchange, filterChain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        verify(filterChain, never()).filter(any());
    }
}
