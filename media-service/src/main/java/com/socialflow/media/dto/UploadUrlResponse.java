package com.socialflow.media.dto;

public record UploadUrlResponse(
        String fileKey,
        String uploadUrl,
        String accessUrl
) {}