package com.socialflow.post.event;

import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostRepostedEvent {
    private Long repostId;
    private Long originalPostId;
    private Long authorId;
    private String authorUsername;
    private String quoteComment;
    private LocalDateTime createdAt;
}