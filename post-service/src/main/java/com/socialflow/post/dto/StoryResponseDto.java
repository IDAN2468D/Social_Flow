package com.socialflow.post.dto;

import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StoryResponseDto {
    private Long id;
    private Long userId;
    private String username;
    private String userAvatar;
    private String mediaUrl;
    private String caption;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
}
