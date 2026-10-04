package com.socialflow.user.event;

import java.io.Serializable;
import java.time.LocalDateTime;

public class UserRegisteredEvent implements Serializable {

    private Long userId;
    private String username;
    private String email;
    private LocalDateTime timestamp;

    public UserRegisteredEvent() {}

    public UserRegisteredEvent(Long userId, String username, String email) {
        this.userId = userId;
        this.username = username;
        this.email = email;
        this.timestamp = LocalDateTime.now();
    }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}