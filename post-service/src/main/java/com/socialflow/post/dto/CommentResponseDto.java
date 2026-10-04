package com.socialflow.post.dto;

import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommentResponseDto {
    private Long id;
    private Long postId;
    private Long authorId;
    private String authorUsername;
    private String authorAvatar;
    private String content;
    private LocalDateTime createdAt;
}