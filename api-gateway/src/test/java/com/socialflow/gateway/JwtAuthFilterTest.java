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

    @Test
    void testPublicReadAndHealthRoutesBypassAuthOnGet() {
        for (String path : new String[]{
                "/api/v1/ai/health",
                "/api/v1/stories",
                "/api/v1/search/multi",
                "/api/search",
                "/api/v1/feed/trending",
                "/api/v1/feed/trending-tags",
                "/api/v1/feed/for-you",
                "/api/v1/users/profile/idan",
                "/api/users/profile/idan",
                "/api/v1/users/search"
        }) {
            MockServerHttpRequest request = MockServerHttpRequest.get(path).build();
            MockServerWebExchange exchange = MockServerWebExchange.from(request);

            jwtAuthFilter.filter(exchange, filterChain).block();

            assertNull(exchange.getResponse().getStatusCode(), "Expected public GET access for " + path);
        }
        verify(filterChain, times(10)).filter(any());
    }

    @Test
    void testPublicGetRouteStillForwardsIdentityHeadersWhenTokenPresent() {
        String token = generateTestToken(42L, "idan", "idan@example.com", 60000);
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/users/profile/noa")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        jwtAuthFilter.filter(exchange, filterChain).block();

        verify(filterChain, times(1)).filter(argThat(ex -> {
            HttpHeaders headers = ex.getRequest().getHeaders();
            return "42".equals(headers.getFirst("X-Auth-UserId")) &&
                   "idan".equals(headers.getFirst("X-Auth-Username"));
        }));
    }

    @Test
    void testMutationsRemainProtectedWithoutToken() {
        MockServerWebExchange postStory = MockServerWebExchange.from(MockServerHttpRequest.post("/api/v1/stories").build());
        MockServerWebExchange postFollow = MockServerWebExchange.from(MockServerHttpRequest.post("/api/v1/users/noa/follow").build());
        MockServerWebExchange deleteFollow = MockServerWebExchange.from(MockServerHttpRequest.delete("/api/v1/users/noa/follow").build());
        MockServerWebExchange putProfile = MockServerWebExchange.from(MockServerHttpRequest.put("/api/v1/users/profile").build());

        jwtAuthFilter.filter(postStory, filterChain).block();
        jwtAuthFilter.filter(postFollow, filterChain).block();
        jwtAuthFilter.filter(deleteFollow, filterChain).block();
        jwtAuthFilter.filter(putProfile, filterChain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, postStory.getResponse().getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, postFollow.getResponse().getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, deleteFollow.getResponse().getStatusCode());
        assertEquals(HttpStatus.UNAUTHORIZED, putProfile.getResponse().getStatusCode());
        verify(filterChain, never()).filter(any());
    }

    @Test
    void testAdminRoleClaimForwardsNormalizedRoleHeader() {
        SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        String adminToken = Jwts.builder()
                .claims(Map.of("userId", 7L, "email", "admin@socialflow.ai", "role", "ROLE_ADMIN"))
                .subject("admin")
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + 60000))
                .signWith(key)
                .compact();

        MockServerHttpRequest request = MockServerHttpRequest.put("/api/v1/users/idan/role")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        jwtAuthFilter.filter(exchange, filterChain).block();

        verify(filterChain, times(1)).filter(argThat(ex ->
                "ADMIN".equals(ex.getRequest().getHeaders().getFirst("X-User-Role")) &&
                "admin".equals(ex.getRequest().getHeaders().getFirst("X-Auth-Username"))));
    }

    @Test
    void testSpoofedIdentityHeadersAreStrippedOnPublicPathsWithoutToken() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/feed/trending")
                .header("X-User-Role", "ADMIN")
                .header("X-User-Id", "1")
                .header("X-Auth-UserId", "1")
                .header("X-Auth-Username", "spoofedAdmin")
                .header("X-User-Name", "spoofedAdmin")
                .header("X-User-Email", "spoof@evil.com")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        jwtAuthFilter.filter(exchange, filterChain).block();

        verify(filterChain, times(1)).filter(argThat(ex -> {
            HttpHeaders h = ex.getRequest().getHeaders();
            return !h.containsKey("X-User-Role")
                    && !h.containsKey("X-User-Id")
                    && !h.containsKey("X-Auth-UserId")
                    && !h.containsKey("X-Auth-Username")
                    && !h.containsKey("X-User-Name")
                    && !h.containsKey("X-User-Email");
        }));
    }

    @Test
    void testSpoofedIdentityHeadersAreReplacedNotAppendedOnAuthenticatedRequest() {
        String userToken = generateTestToken(42L, "idan", "idan@example.com", 60000);
        MockServerHttpRequest request = MockServerHttpRequest.post("/api/v1/posts")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + userToken)
                .header("X-User-Role", "ADMIN")
                .header("X-User-Id", "1")
                .header("X-Auth-UserId", "1")
                .header("X-Auth-Username", "spoofedAdmin")
                .header("X-User-Custom", "evil")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        jwtAuthFilter.filter(exchange, filterChain).block();

        verify(filterChain, times(1)).filter(argThat(ex -> {
            HttpHeaders h = ex.getRequest().getHeaders();
            return java.util.List.of("USER").equals(h.get("X-User-Role"))
                    && java.util.List.of("42").equals(h.get("X-User-Id"))
                    && java.util.List.of("42").equals(h.get("X-Auth-UserId"))
                    && java.util.List.of("idan").equals(h.get("X-Auth-Username"))
                    && !h.containsKey("X-User-Custom");
        }));
    }

    @Test
    void testSpoofedIdentityHeadersAreStrippedWhenInvalidTokenOnPublicPath() {
        MockServerHttpRequest request = MockServerHttpRequest.get("/api/v1/users/profile/idan")
                .header(HttpHeaders.AUTHORIZATION, "Bearer invalid.jwt.token")
                .header("X-User-Role", "ADMIN")
                .header("X-Auth-Username", "spoofed")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        jwtAuthFilter.filter(exchange, filterChain).block();

        verify(filterChain, times(1)).filter(argThat(ex -> {
            HttpHeaders h = ex.getRequest().getHeaders();
            return !h.containsKey("X-User-Role") && !h.containsKey("X-Auth-Username");
        }));
    }

    @Test
    void testTokenMissingUserIdClaimReturns401OnProtectedPath() {
        SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        String missingUserIdToken = Jwts.builder()
                .subject("idan")
                .issuedAt(new Date(System.currentTimeMillis()))
                .expiration(new Date(System.currentTimeMillis() + 60000))
                .signWith(key)
                .compact();

        MockServerHttpRequest request = MockServerHttpRequest.post("/api/v1/posts")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + missingUserIdToken)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        jwtAuthFilter.filter(exchange, filterChain).block();

        assertEquals(HttpStatus.UNAUTHORIZED, exchange.getResponse().getStatusCode());
        verify(filterChain, never()).filter(any());
    }
}
