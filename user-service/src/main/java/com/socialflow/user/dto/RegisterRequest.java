package com.socialflow.user.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class RegisterRequest {

    @NotBlank(message = "שם משתמש הוא שדה חובה")
    @Size(min = 3, max = 50, message = "שם משתמש חייב להיות בין 3 ל-50 תווים")
    private String username;

    @NotBlank(message = "אימייל הוא שדה חובה")
    @Email(message = "כתובת אימייל אינה תקינה")
    private String email;

    @NotBlank(message = "סיסמה היא שדה חובה")
    @Size(min = 6, message = "סיסמה חייבת להכיל לפחות 6 תווים")
    private String password;

    private String fullName;

    public RegisterRequest() {}

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
}