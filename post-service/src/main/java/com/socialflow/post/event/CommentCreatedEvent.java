package com.socialflow.post.event;

import lombok.*;
import java.time.LocalDateTime;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CommentCreatedEvent {
    private Long commentId;
    private Long postId;
    private Long authorId;
    private String authorUsername;
    private Long postAuthorId;
    private String content;
    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}