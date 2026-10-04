package com.socialflow.post.event;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostCreatedEvent {
    private Long postId;
    private Long authorId;
    private String authorUsername;
    private String content;
    private List<String> mediaUrls;
    private List<String> tags;
    private Set<String> mentions;
    private boolean hasPoll;
    private boolean isRepost;
    private Long originalPostId;
    private String visibility;
    private LocalDateTime createdAt;
}