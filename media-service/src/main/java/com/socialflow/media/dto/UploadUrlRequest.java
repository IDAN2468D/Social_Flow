package com.socialflow.media.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UploadUrlRequest(
        @NotBlank(message = "Filename is required")
        String filename,

        @NotBlank(message = "ContentType is required")
        @Pattern(regexp = "^(image/jpeg|image/png|image/webp|image/gif)$", message = "Supported formats: image/jpeg, image/png, image/webp, image/gif")
        String contentType
) {}