package com.socialflow.post.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CreatePostRequest {

    @NotBlank(message = "Post content cannot be empty")
    private String content;

    private List<String> mediaUrls;

    private List<String> tags;

    private String visibility;

    private CreatePollRequest poll;
}