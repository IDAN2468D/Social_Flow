package com.socialflow.user.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.Size;

/**
 * Request payload for updating the authenticated user's profile fields.
 */
public class UpdateProfileRequest {

    @Size(max = 100, message = "שם מלא לא יכול לעלות על 100 תווים")
    private String fullName;

    @Size(max = 250, message = "ביוגרפיה לא יכולה לעלות על 250 תווים")
    private String bio;

    @JsonAlias({"avatarUrl"})
    @Size(max = 500, message = "כתובת תמונת פרופיל ארוכה מדי")
    private String profileImageUrl;

    public UpdateProfileRequest() {}

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }

    public String getProfileImageUrl() { return profileImageUrl; }
    public void setProfileImageUrl(String profileImageUrl) { this.profileImageUrl = profileImageUrl; }
}
