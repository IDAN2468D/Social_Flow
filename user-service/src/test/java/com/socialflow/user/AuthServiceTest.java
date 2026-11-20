package com.socialflow.user;

import com.socialflow.user.controller.AuthController;
import com.socialflow.user.dto.AuthResponse;
import com.socialflow.user.dto.LoginRequest;
import com.socialflow.user.dto.RefreshTokenRequest;
import com.socialflow.user.dto.RegisterRequest;
import com.socialflow.user.model.RefreshToken;
import com.socialflow.user.model.User;
import com.socialflow.user.repository.RefreshTokenRepository;
import com.socialflow.user.repository.UserRepository;
import com.socialflow.user.service.AuthService;
import com.socialflow.user.service.JwtService;
import com.socialflow.user.service.UserEventProducer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private UserEventProducer eventProducer;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    private AuthService authService;
    private User sampleUser;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository,
                passwordEncoder,
                jwtService,
                eventProducer,
                refreshTokenRepository
        );
        sampleUser = new User("idan", "idan@example.com", "encodedPassword", "Idan Kazam");
        sampleUser.setId(1L);
        sampleUser.setRole("USER");
    }

    @Test
    void testRegisterSuccess() {
        RegisterRequest req = new RegisterRequest();
        req.setUsername("idan");
        req.setEmail("idan@example.com");
        req.setPassword("Secret123!");
        req.setFullName("Idan Kazam");

        when(userRepository.existsByUsername("idan")).thenReturn(false);
        when(userRepository.existsByEmail("idan@example.com")).thenReturn(false);
        when(passwordEncoder.encode("Secret123!")).thenReturn("encodedPassword");
        when(userRepository.save(any(User.class))).thenReturn(sampleUser);
        when(jwtService.generateToken(1L, "idan", "idan@example.com", "USER")).thenReturn("mocked.jwt.token");

        AuthResponse resp = authService.register(req);

        assertNotNull(resp);
        assertEquals("mocked.jwt.token", resp.getToken());
        assertNotNull(resp.getRefreshToken());
        assertFalse(resp.getRefreshToken().isBlank());
        assertEquals("idan", resp.getUsername());
        assertEquals("USER", resp.getRole());
        assertEquals(1L, resp.getUserId());
        verify(eventProducer, times(1)).emitUserRegistered(any());
        verify(userRepository, times(1)).save(any(User.class));
        verify(refreshTokenRepository, times(1)).save(any(RefreshToken.class));
    }

    @Test
    void testRegisterDuplicateUsernameThrowsException() {
        RegisterRequest req = new RegisterRequest();
        req.setUsername("idan");
        req.setEmail("idan@example.com");

        when(userRepository.existsByUsername("idan")).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> authService.register(req));
        verify(userRepository, never()).save(any());
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void testLoginSuccess() {
        LoginRequest req = new LoginRequest();
        req.setUsername("idan");
        req.setPassword("Secret123!");

        when(userRepository.findByUsername("idan")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("Secret123!", "encodedPassword")).thenReturn(true);
        when(jwtService.generateToken(1L, "idan", "idan@example.com", "USER")).thenReturn("valid.jwt.token");

        AuthResponse resp = authService.login(req);

        assertNotNull(resp);
        assertEquals("valid.jwt.token", resp.getToken());
        assertNotNull(resp.getRefreshToken());
        assertEquals("idan", resp.getUsername());
        assertEquals("USER", resp.getRole());
        verify(refreshTokenRepository, times(1)).save(any(RefreshToken.class));
    }

    @Test
    void testLoginAdminPropagatesRealAdminRoleToJwt() {
        sampleUser.setRole("ADMIN");
        LoginRequest req = new LoginRequest();
        req.setUsername("idan");
        req.setPassword("Secret123!");

        when(userRepository.findByUsername("idan")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("Secret123!", "encodedPassword")).thenReturn(true);
        when(jwtService.generateToken(1L, "idan", "idan@example.com", "ADMIN")).thenReturn("admin.jwt.token");

        AuthResponse resp = authService.login(req);

        assertEquals("admin.jwt.token", resp.getToken());
        assertEquals("ADMIN", resp.getRole());
        verify(jwtService, times(1)).generateToken(1L, "idan", "idan@example.com", "ADMIN");
    }

    @Test
    void testJwtServiceEmbedsRealRoleAndJti() {
        JwtService realJwtService = new JwtService();
        ReflectionTestUtils.setField(realJwtService, "secretKey", "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970");
        ReflectionTestUtils.setField(realJwtService, "jwtExpiration", 60000L);

        String adminToken = realJwtService.generateToken(7L, "admin", "admin@socialflow.ai", "ROLE_ADMIN");

        assertEquals("ADMIN", realJwtService.extractRole(adminToken));
        assertEquals(7L, realJwtService.extractUserId(adminToken));
        assertEquals("admin", realJwtService.extractUsername(adminToken));
        assertNotNull(realJwtService.extractJti(adminToken));
    }

    @Test
    void testRefreshRotatesTokenAndPreservesFamilyAndCurrentRole() {
        sampleUser.setRole("ADMIN");
        String rawOldToken = "old-raw-refresh-token";
        String oldHash = authService.hashToken(rawOldToken);
        RefreshToken existing = new RefreshToken(oldHash, "fam-123", 1L, LocalDateTime.now().plusDays(7));

        when(refreshTokenRepository.findByTokenHash(oldHash)).thenReturn(Optional.of(existing));
        when(userRepository.findById(1L)).thenReturn(Optional.of(sampleUser));
        when(jwtService.generateToken(1L, "idan", "idan@example.com", "ADMIN")).thenReturn("rotated.jwt.token");

        AuthResponse resp = authService.refresh(rawOldToken);

        assertEquals("rotated.jwt.token", resp.getToken());
        assertEquals("ADMIN", resp.getRole());
        assertNotNull(resp.getRefreshToken());
        assertNotEquals(rawOldToken, resp.getRefreshToken());
        assertTrue(existing.isRevoked());
        assertNotNull(existing.getReplacedByHash());

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository, times(2)).save(captor.capture());
        RefreshToken newSaved = captor.getAllValues().get(1);
        assertEquals("fam-123", newSaved.getFamilyId());
        assertEquals(1L, newSaved.getUserId());
        assertFalse(newSaved.isRevoked());
        assertEquals(existing.getReplacedByHash(), newSaved.getTokenHash());
    }

    @Test
    void testRefreshReuseDetectionRevokesEntireFamily() {
        String rawReusedToken = "reused-token";
        String reusedHash = authService.hashToken(rawReusedToken);
        RefreshToken revoked = new RefreshToken(reusedHash, "fam-compromised", 1L, LocalDateTime.now().plusDays(7));
        revoked.setRevoked(true);

        when(refreshTokenRepository.findByTokenHash(reusedHash)).thenReturn(Optional.of(revoked));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> authService.refresh(rawReusedToken));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
        verify(refreshTokenRepository, times(1)).revokeFamily(eq("fam-compromised"), any(LocalDateTime.class));
        verify(jwtService, never()).generateToken(any(), any(), any(), any());
    }

    @Test
    void testRefreshExpiredTokenThrows401() {
        String rawExpired = "expired-token";
        String expiredHash = authService.hashToken(rawExpired);
        RefreshToken expired = new RefreshToken(expiredHash, "fam-exp", 1L, LocalDateTime.now().minusMinutes(5));

        when(refreshTokenRepository.findByTokenHash(expiredHash)).thenReturn(Optional.of(expired));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> authService.refresh(rawExpired));
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getStatusCode());
        assertTrue(expired.isRevoked());
        verify(refreshTokenRepository, times(1)).save(expired);
    }

    @Test
    void testLogoutRevokesFamilyAndAllSessions() {
        String rawToken = "logout-token";
        String hash = authService.hashToken(rawToken);
        RefreshToken token = new RefreshToken(hash, "fam-logout", 1L, LocalDateTime.now().plusDays(7));
        when(refreshTokenRepository.findByTokenHash(hash)).thenReturn(Optional.of(token));

        authService.logout(rawToken, null, false);
        verify(refreshTokenRepository, times(1)).revokeFamily(eq("fam-logout"), any(LocalDateTime.class));

        authService.logout(rawToken, null, true);
        verify(refreshTokenRepository, times(1)).revokeAllByUserId(eq(1L), any(LocalDateTime.class));
    }

    @Test
    void testAuthControllerRefreshAndLogoutCookies() {
        AuthService mockedService = mock(AuthService.class);
        when(mockedService.getRefreshExpirationMs()).thenReturn(604800000L);
        AuthController controller = new AuthController(mockedService);

        AuthResponse rotated = new AuthResponse("new.jwt", "new.refresh", 1L, "idan", "idan@example.com", "ADMIN");
        when(mockedService.refresh("cookie-refresh")).thenReturn(rotated);

        ResponseEntity<AuthResponse> refreshResp = controller.refresh(null, "cookie-refresh");
        assertEquals(HttpStatus.OK, refreshResp.getStatusCode());
        assertEquals("new.jwt", refreshResp.getBody().getToken());
        List<String> setCookies = refreshResp.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertNotNull(setCookies);
        assertTrue(setCookies.stream().anyMatch(c -> c.startsWith("jwt=new.jwt")));
        assertTrue(setCookies.stream().anyMatch(c -> c.startsWith("refresh_token=new.refresh")));

        ResponseEntity<Map<String, String>> logoutResp = controller.logout(
                new RefreshTokenRequest("body-refresh"), null, null, null, false);
        assertEquals(HttpStatus.OK, logoutResp.getStatusCode());
        verify(mockedService, times(1)).logout("body-refresh", null, false);
        List<String> clearedCookies = logoutResp.getHeaders().get(HttpHeaders.SET_COOKIE);
        assertNotNull(clearedCookies);
        assertTrue(clearedCookies.stream().anyMatch(c -> c.startsWith("jwt=") && c.contains("Max-Age=0")));
        assertTrue(clearedCookies.stream().anyMatch(c -> c.startsWith("refresh_token=") && c.contains("Max-Age=0")));
    }

    @Test
    void testLoginWrongPasswordThrowsException() {
        LoginRequest req = new LoginRequest();
        req.setUsername("idan");
        req.setPassword("WrongPassword");

        when(userRepository.findByUsername("idan")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("WrongPassword", "encodedPassword")).thenReturn(false);

        assertThrows(IllegalArgumentException.class, () -> authService.login(req));
    }

    @Test
    void testLoginUserNotFoundThrowsException() {
        LoginRequest req = new LoginRequest();
        req.setUsername("nonexistent");
        req.setPassword("Pass");

        when(userRepository.findByUsername("nonexistent")).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class, () -> authService.login(req));
    }
}
