package com.socialflow.post.dto;

import com.socialflow.post.model.ReactionType;
import lombok.*;

import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReactionSummaryDto {
    private Long postId;
    private int totalReactions;
    private Map<ReactionType, Long> countsByType;
    private ReactionType userReaction;
}