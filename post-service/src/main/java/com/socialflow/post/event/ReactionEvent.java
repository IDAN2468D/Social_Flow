package com.socialflow.post.event;

import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReactionEvent {
    private Long postId;
    private Long userId;
    private String username;
    private Long authorId;
    private String reactionType;
    private boolean active;

    @Builder.Default
    private String eventType = "POST_REACTION";

    @Builder.Default
    private LocalDateTime timestamp = LocalDateTime.now();
}
