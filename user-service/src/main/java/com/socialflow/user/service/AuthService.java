package com.socialflow.user.service;

import com.socialflow.user.dto.AuthResponse;
import com.socialflow.user.dto.LoginRequest;
import com.socialflow.user.dto.RegisterRequest;
import com.socialflow.user.event.UserRegisteredEvent;
import com.socialflow.user.model.User;
import com.socialflow.user.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final UserEventProducer eventProducer;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       UserEventProducer eventProducer) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.eventProducer = eventProducer;
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

        // הפקת טוקן JWT
        String token = jwtService.generateToken(savedUser.getId(), savedUser.getUsername(), savedUser.getEmail());

        return new AuthResponse(token, savedUser.getId(), savedUser.getUsername(), savedUser.getEmail());
    }

    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> new IllegalArgumentException("שם משתמש או סיסמה שגויים"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("שם משתמש או סיסמה שגויים");
        }

        String token = jwtService.generateToken(user.getId(), user.getUsername(), user.getEmail());

        return new AuthResponse(token, user.getId(), user.getUsername(), user.getEmail());
    }
}