package com.socialflow.post.event;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostPinnedEvent {
    private Long postId;
    private Long authorId;
    private boolean pinned;

    @Builder.Default
    private String eventType = "POST_PINNED";
}
