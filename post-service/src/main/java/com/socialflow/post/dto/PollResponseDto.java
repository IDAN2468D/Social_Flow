package com.socialflow.post.dto;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PollResponseDto {
    private Long id;
    private String question;
    private List<PollOptionDto> options;
    private int totalVotes;
    private boolean isExpired;
    private boolean hasVoted;
    private Long selectedOptionId;
    private LocalDateTime expiresAt;
}