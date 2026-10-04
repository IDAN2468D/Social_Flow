package com.socialflow.post.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreatePollRequest {

    @NotBlank(message = "Poll question is required")
    private String question;

    @NotEmpty(message = "Poll must contain options")
    @Size(min = 2, max = 5, message = "Poll must have between 2 and 5 options")
    private List<String> options;

    @Builder.Default
    private int durationHours = 24;
}