package com.socialflow.post.dto;

import com.socialflow.post.model.ReactionType;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostResponseDto {
    private Long id;
    private Long authorId;
    private String authorUsername;
    private String authorAvatar;
    private String content;
    private List<String> mediaUrls;
    private List<String> tags;
    private Set<String> mentions;
    private int likesCount;
    private int commentsCount;
    private int repostsCount;
    private boolean isLiked;
    private boolean isBookmarked;
    private boolean isPinned;
    private String visibility;
    private boolean isRepost;
    private Long originalPostId;
    private String quoteComment;
    private PostResponseDto originalPost;
    private PollResponseDto poll;
    private ReactionType userReaction;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}