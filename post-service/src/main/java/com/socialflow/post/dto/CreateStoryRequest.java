package com.socialflow.post.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreateStoryRequest {

    @NotBlank(message = "Media URL cannot be empty")
    private String mediaUrl;

    private String caption;

    private String userAvatar;
}
