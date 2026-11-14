package com.socialflow.media;

import com.socialflow.media.dto.UploadUrlRequest;
import com.socialflow.media.dto.UploadUrlResponse;
import com.socialflow.media.service.MediaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MediaServiceTest {

    @Mock
    private S3Client s3Client;

    @Mock
    private S3Presigner s3Presigner;

    private MediaService mediaService;

    @BeforeEach
    void setUp() {
        mediaService = new MediaService(s3Client, s3Presigner, "socialflow-media", "http://localhost:9000");
    }

    @Test
    @DisplayName("generateUploadUrl creates presigned upload url and access url")
    void generateUploadUrl_Success() throws Exception {
        Long userId = 42L;
        UploadUrlRequest request = new UploadUrlRequest("avatar.png", "image/png");

        PresignedPutObjectRequest presignedPut = mock(PresignedPutObjectRequest.class);
        when(presignedPut.url()).thenReturn(URI.create("http://localhost:9000/socialflow-media/uploads/42/test.png").toURL());
        when(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).thenReturn(presignedPut);

        UploadUrlResponse response = mediaService.generateUploadUrl(userId, request);

        assertThat(response).isNotNull();
        assertThat(response.fileKey()).startsWith("uploads/42/");
        assertThat(response.fileKey()).endsWith(".png");
        assertThat(response.uploadUrl()).isEqualTo("http://localhost:9000/socialflow-media/uploads/42/test.png");
        assertThat(response.accessUrl()).contains("http://localhost:9000/socialflow-media/uploads/42/");
    }
}
