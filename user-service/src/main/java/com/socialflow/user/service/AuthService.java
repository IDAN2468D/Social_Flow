package com.socialflow.user.service;

import com.socialflow.user.dto.AuthResponse;
import com.socialflow.user.dto.LoginRequest;
import com.socialflow.user.dto.RegisterRequest;
import com.socialflow.user.event.UserRegisteredEvent;
import com.socialflow.user.model.RefreshToken;
import com.socialflow.user.model.User;
import com.socialflow.user.repository.RefreshTokenRepository;
import com.socialflow.user.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final long DEFAULT_REFRESH_EXPIRATION_MS = Duration.ofDays(7).toMillis();

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserEventProducer eventProducer;
    private final RefreshTokenRepository refreshTokenRepository;
    private final long refreshExpirationMs;

    @Autowired
    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       UserEventProducer eventProducer,
                       RefreshTokenRepository refreshTokenRepository,
                       @Value("${jwt.refresh-expiration:604800000}") long refreshExpirationMs) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.eventProducer = eventProducer;
        this.refreshTokenRepository = refreshTokenRepository;
        this.refreshExpirationMs = refreshExpirationMs > 0 ? refreshExpirationMs : DEFAULT_REFRESH_EXPIRATION_MS;
    }

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       UserEventProducer eventProducer,
                       RefreshTokenRepository refreshTokenRepository) {
        this(userRepository, passwordEncoder, jwtService, eventProducer, refreshTokenRepository, DEFAULT_REFRESH_EXPIRATION_MS);
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByUsername(request.getUsername())) {
            throw new IllegalArgumentException("שם המשתמש כבר תפוס במערכת");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("כתובת האימייל כבר קיימת במערכת");
        }

        // יצירת משתמש עם סיסמה מוצפנת ב-BCrypt
        User user = new User(
                request.getUsername(),
                request.getEmail(),
                passwordEncoder.encode(request.getPassword()),
                request.getFullName()
        );

        User savedUser = userRepository.save(user);

        // שידור אירוע אסינכרוני ל-Kafka
        eventProducer.emitUserRegistered(
                new UserRegisteredEvent(savedUser.getId(), savedUser.getUsername(), savedUser.getEmail())
        );

        // הפקת טוקן JWT עם התפקיד האמיתי של המשתמש וטוקן רענון
        String role = savedUser.getRole();
        String token = jwtService.generateToken(savedUser.getId(), savedUser.getUsername(), savedUser.getEmail(), role);
        String refreshToken = issueRefreshToken(savedUser.getId(), UUID.randomUUID().toString());

        return new AuthResponse(token, refreshToken, savedUser.getId(), savedUser.getUsername(), savedUser.getEmail(), role);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String identifier = request.getUsername() != null ? request.getUsername().trim() : "";
        User user = userRepository.findByUsername(identifier)
                .or(() -> userRepository.findByEmail(identifier))
                .orElseThrow(() -> new IllegalArgumentException("שם משתמש או סיסמה שגויים"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("שם משתמש או סיסמה שגויים");
        }

        String role = user.getRole();
        String token = jwtService.generateToken(user.getId(), user.getUsername(), user.getEmail(), role);
        String refreshToken = issueRefreshToken(user.getId(), UUID.randomUUID().toString());

        return new AuthResponse(token, refreshToken, user.getId(), user.getUsername(), user.getEmail(), role);
    }

    @Transactional(noRollbackFor = ResponseStatusException.class)
    public AuthResponse refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token is required");
        }

        String tokenHash = hashToken(rawRefreshToken.trim());
        RefreshToken existing = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token"));

        LocalDateTime now = LocalDateTime.now();

        if (existing.isRevoked()) {
            // Reuse detection: revoke entire token family
            refreshTokenRepository.revokeFamily(existing.getFamilyId(), now);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token reuse detected; session revoked");
        }

        if (existing.isExpired()) {
            existing.setRevoked(true);
            existing.setRevokedAt(now);
            refreshTokenRepository.save(existing);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
        }

        User user = userRepository.findById(existing.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        String newRawRefreshToken = generateOpaqueToken();
        String newTokenHash = hashToken(newRawRefreshToken);

        existing.setRevoked(true);
        existing.setRevokedAt(now);
        existing.setReplacedByHash(newTokenHash);
        refreshTokenRepository.save(existing);

        RefreshToken rotated = new RefreshToken(
                newTokenHash,
                existing.getFamilyId(),
                user.getId(),
                now.plus(Duration.ofMillis(refreshExpirationMs))
        );
        refreshTokenRepository.save(rotated);

        String role = user.getRole();
        String newAccessToken = jwtService.generateToken(user.getId(), user.getUsername(), user.getEmail(), role);

        return new AuthResponse(newAccessToken, newRawRefreshToken, user.getId(), user.getUsername(), user.getEmail(), role);
    }

    @Transactional
    public void logout(String rawRefreshToken, String accessToken, boolean allSessions) {
        LocalDateTime now = LocalDateTime.now();
        Long resolvedUserId = null;

        if (accessToken != null && !accessToken.isBlank()) {
            try {
                resolvedUserId = jwtService.extractUserId(accessToken.trim());
            } catch (Exception ignored) {
                // Access token may already be expired during logout
            }
        }

        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            String tokenHash = hashToken(rawRefreshToken.trim());
            Optional<RefreshToken> found = refreshTokenRepository.findByTokenHash(tokenHash);
            if (found.isPresent()) {
                RefreshToken token = found.get();
                if (resolvedUserId == null) {
                    resolvedUserId = token.getUserId();
                }
                if (allSessions) {
                    refreshTokenRepository.revokeAllByUserId(resolvedUserId, now);
                } else {
                    refreshTokenRepository.revokeFamily(token.getFamilyId(), now);
                }
                return;
            }
        }

        if (allSessions && resolvedUserId != null) {
            refreshTokenRepository.revokeAllByUserId(resolvedUserId, now);
        }
    }

    public long getRefreshExpirationMs() {
        return refreshExpirationMs;
    }

    public String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm not available", e);
        }
    }

    private String issueRefreshToken(Long userId, String familyId) {
        String rawToken = generateOpaqueToken();
        String tokenHash = hashToken(rawToken);
        LocalDateTime expiresAt = LocalDateTime.now().plus(Duration.ofMillis(refreshExpirationMs));
        refreshTokenRepository.save(new RefreshToken(tokenHash, familyId, userId, expiresAt));
        return rawToken;
    }

    private String generateOpaqueToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}