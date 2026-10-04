package com.socialflow.post.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PollOptionDto {
    private Long id;
    private String text;
    private int voteCount;
    private double percentage;
    private boolean isSelected;
}