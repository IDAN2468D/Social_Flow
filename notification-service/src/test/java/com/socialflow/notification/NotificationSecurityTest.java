package com.socialflow.notification;

import com.socialflow.notification.security.JwtAuthenticationFilter;
import com.socialflow.notification.security.StompAuthChannelInterceptor;
import com.socialflow.notification.security.UserPrincipal;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class NotificationSecurityTest {

    private static final String SECRET = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";

    private JwtAuthenticationFilter jwtFilter;
    private StompAuthChannelInterceptor stompInterceptor;
    private MessageChannel channel;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        jwtFilter = new JwtAuthenticationFilter();
        ReflectionTestUtils.setField(jwtFilter, "secretKey", SECRET);
        stompInterceptor = new StompAuthChannelInterceptor(SECRET);
        channel = mock(MessageChannel.class);
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private String mintJwt(Long userId, String username, String role, long ttlMs) {
        SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(SECRET));
        return Jwts.builder()
                .claims(Map.of("userId", userId, "role", role))
                .subject(username)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + ttlMs))
                .signWith(key)
                .compact();
    }

    @Test
    @DisplayName("JwtAuthenticationFilter reads real ADMIN role from X-User-Role header")
    void jwtFilterPropagatesAdminRoleFromHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/notifications");
        request.addHeader("X-Auth-UserId", "7");
        request.addHeader("X-Auth-Username", "admin");
        request.addHeader("X-User-Role", "ADMIN");

        jwtFilter.doFilter(request, new MockHttpServletResponse(), mock(FilterChain.class));

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getAuthorities()).extracting("authority").containsExactly("ROLE_ADMIN");
        assertThat(((UserPrincipal) auth.getPrincipal()).getRole()).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("JwtAuthenticationFilter reads real ADMIN role from Bearer JWT claim")
    void jwtFilterPropagatesAdminRoleFromBearerJwt() throws Exception {
        String token = mintJwt(7L, "admin", "ROLE_ADMIN", 60000);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/notifications");
        request.addHeader("Authorization", "Bearer " + token);

        jwtFilter.doFilter(request, new MockHttpServletResponse(), mock(FilterChain.class));

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNotNull();
        assertThat(auth.getAuthorities()).extracting("authority").containsExactly("ROLE_ADMIN");
        assertThat(((UserPrincipal) auth.getPrincipal()).getRole()).isEqualTo("ADMIN");
    }

    @Test
    @DisplayName("STOMP CONNECT rejects missing, invalid, and expired JWT tokens")
    void stompConnectRejectsUnauthenticatedOrInvalidJwt() {
        StompHeaderAccessor missingToken = StompHeaderAccessor.create(StompCommand.CONNECT);
        missingToken.setLeaveMutable(true);
        Message<byte[]> missingMsg = MessageBuilder.createMessage(new byte[0], missingToken.getMessageHeaders());
        assertThatThrownBy(() -> stompInterceptor.preSend(missingMsg, channel))
                .isInstanceOf(AccessDeniedException.class);

        StompHeaderAccessor invalidToken = StompHeaderAccessor.create(StompCommand.CONNECT);
        invalidToken.setNativeHeader("Authorization", "Bearer invalid.jwt.token");
        invalidToken.setLeaveMutable(true);
        Message<byte[]> invalidMsg = MessageBuilder.createMessage(new byte[0], invalidToken.getMessageHeaders());
        assertThatThrownBy(() -> stompInterceptor.preSend(invalidMsg, channel))
                .isInstanceOf(AccessDeniedException.class);

        String expiredJwt = mintJwt(42L, "idan", "USER", -10000);
        StompHeaderAccessor expiredAccessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        expiredAccessor.setNativeHeader("Authorization", "Bearer " + expiredJwt);
        expiredAccessor.setLeaveMutable(true);
        Message<byte[]> expiredMsg = MessageBuilder.createMessage(new byte[0], expiredAccessor.getMessageHeaders());
        assertThatThrownBy(() -> stompInterceptor.preSend(expiredMsg, channel))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    @DisplayName("STOMP CONNECT authenticates valid JWT and attaches UserPrincipal")
    void stompConnectAuthenticatesValidJwt() {
        String validJwt = mintJwt(42L, "idan", "USER", 60000);
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setNativeHeader("Authorization", "Bearer " + validJwt);
        accessor.setLeaveMutable(true);
        Message<byte[]> msg = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());

        stompInterceptor.preSend(msg, channel);

        assertThat(accessor.getUser()).isInstanceOf(Authentication.class);
        Authentication auth = (Authentication) accessor.getUser();
        UserPrincipal principal = (UserPrincipal) auth.getPrincipal();
        assertThat(principal.getUserId()).isEqualTo(42L);
        assertThat(principal.getUsername()).isEqualTo("idan");
        assertThat(principal.getRole()).isEqualTo("USER");
    }

    @Test
    @DisplayName("STOMP SUBSCRIBE allows own user channel, blocks other user's channel and wildcards, allows ADMIN")
    void stompSubscribeEnforcesChannelOwnership() {
        Authentication user42 = new UsernamePasswordAuthenticationToken(
                new UserPrincipal(42L, "idan", "USER"),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_USER"))
        );
        Authentication admin7 = new UsernamePasswordAuthenticationToken(
                new UserPrincipal(7L, "admin", "ADMIN"),
                null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );

        // Own channel -> allowed
        StompHeaderAccessor ownSub = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        ownSub.setUser(user42);
        ownSub.setDestination("/topic/user.42.notifications");
        Message<byte[]> ownMsg = MessageBuilder.createMessage(new byte[0], ownSub.getMessageHeaders());
        assertThat(stompInterceptor.preSend(ownMsg, channel)).isSameAs(ownMsg);

        // Other user's channel -> denied
        StompHeaderAccessor otherSub = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        otherSub.setUser(user42);
        otherSub.setDestination("/topic/user.99.notifications");
        Message<byte[]> otherMsg = MessageBuilder.createMessage(new byte[0], otherSub.getMessageHeaders());
        assertThatThrownBy(() -> stompInterceptor.preSend(otherMsg, channel))
                .isInstanceOf(AccessDeniedException.class);

        // Wildcard subscription -> denied for USER
        StompHeaderAccessor wildcardSub = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        wildcardSub.setUser(user42);
        wildcardSub.setDestination("/topic/user.*.notifications");
        Message<byte[]> wildcardMsg = MessageBuilder.createMessage(new byte[0], wildcardSub.getMessageHeaders());
        assertThatThrownBy(() -> stompInterceptor.preSend(wildcardMsg, channel))
                .isInstanceOf(AccessDeniedException.class);

        // Unauthenticated subscribe -> denied
        StompHeaderAccessor anonSub = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        anonSub.setDestination("/topic/user.42.notifications");
        Message<byte[]> anonMsg = MessageBuilder.createMessage(new byte[0], anonSub.getMessageHeaders());
        assertThatThrownBy(() -> stompInterceptor.preSend(anonMsg, channel))
                .isInstanceOf(AccessDeniedException.class);

        // ADMIN -> allowed on any user channel
        StompHeaderAccessor adminSub = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        adminSub.setUser(admin7);
        adminSub.setDestination("/topic/user.99.notifications");
        Message<byte[]> adminMsg = MessageBuilder.createMessage(new byte[0], adminSub.getMessageHeaders());
        assertThat(stompInterceptor.preSend(adminMsg, channel)).isSameAs(adminMsg);
    }
}
