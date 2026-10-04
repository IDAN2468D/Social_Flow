package com.socialflow.post.event;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostLikedEvent {
    private Long postId;
    private Long userId;
    private String username;
    private Long authorId;
    private boolean liked;
}