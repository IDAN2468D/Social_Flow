package com.socialflow.user;

import com.socialflow.user.dto.AuthResponse;
import com.socialflow.user.dto.LoginRequest;
import com.socialflow.user.dto.RegisterRequest;
import com.socialflow.user.model.User;
import com.socialflow.user.repository.UserRepository;
import com.socialflow.user.service.AuthService;
import com.socialflow.user.service.JwtService;
import com.socialflow.user.service.UserEventProducer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
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

    @InjectMocks
    private AuthService authService;

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = new User("idan", "idan@example.com", "encodedPassword", "Idan Kazam");
        sampleUser.setId(1L);
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
        when(jwtService.generateToken(1L, "idan", "idan@example.com")).thenReturn("mocked.jwt.token");

        AuthResponse resp = authService.register(req);

        assertNotNull(resp);
        assertEquals("mocked.jwt.token", resp.getToken());
        assertEquals("idan", resp.getUsername());
        assertEquals(1L, resp.getUserId());
        verify(eventProducer, times(1)).emitUserRegistered(any());
        verify(userRepository, times(1)).save(any(User.class));
    }

    @Test
    void testRegisterDuplicateUsernameThrowsException() {
        RegisterRequest req = new RegisterRequest();
        req.setUsername("idan");
        req.setEmail("idan@example.com");

        when(userRepository.existsByUsername("idan")).thenReturn(true);

        assertThrows(IllegalArgumentException.class, () -> authService.register(req));
        verify(userRepository, never()).save(any());
    }

    @Test
    void testLoginSuccess() {
        LoginRequest req = new LoginRequest();
        req.setUsername("idan");
        req.setPassword("Secret123!");

        when(userRepository.findByUsername("idan")).thenReturn(Optional.of(sampleUser));
        when(passwordEncoder.matches("Secret123!", "encodedPassword")).thenReturn(true);
        when(jwtService.generateToken(1L, "idan", "idan@example.com")).thenReturn("valid.jwt.token");

        AuthResponse resp = authService.login(req);

        assertNotNull(resp);
        assertEquals("valid.jwt.token", resp.getToken());
        assertEquals("idan", resp.getUsername());
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
