package com.socialflow.post.event;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostDeletedEvent {
    private Long postId;
    private Long authorId;

    @Builder.Default
    private String eventType = "POST_DELETED";
}