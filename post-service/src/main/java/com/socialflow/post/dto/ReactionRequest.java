package com.socialflow.post.dto;

import com.socialflow.post.model.ReactionType;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReactionRequest {
    @NotNull(message = "Reaction type is required")
    private ReactionType reactionType;
}