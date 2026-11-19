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

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
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

    @Test
    @DisplayName("deleteMedia enforces ownership unless ADMIN and deletes S3 object")
    void deleteMedia_OwnershipAndAdmin() {
        mediaService.deleteMedia(42L, false, "uploads/42/avatar.png");
        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));

        assertThatThrownBy(() -> mediaService.deleteMedia(42L, false, "uploads/99/other.png"))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));

        mediaService.deleteMedia(42L, true, "uploads/99/other.png");
        verify(s3Client, org.mockito.Mockito.times(2)).deleteObject(any(DeleteObjectRequest.class));
    }

    @Test
    @DisplayName("listUserMedia returns uploaded file count and access URLs for user")
    void listUserMedia_ReturnsCountAndFiles() {
        S3Object obj1 = S3Object.builder()
                .key("uploads/42/pic1.png")
                .size(1024L)
                .lastModified(Instant.parse("2026-11-19T09:00:00Z"))
                .build();
        S3Object obj2 = S3Object.builder()
                .key("uploads/42/pic2.jpg")
                .size(2048L)
                .lastModified(Instant.parse("2026-11-19T10:00:00Z"))
                .build();

        when(s3Client.listObjectsV2(any(ListObjectsV2Request.class)))
                .thenReturn(ListObjectsV2Response.builder().contents(List.of(obj1, obj2)).build());

        Map<String, Object> result = mediaService.listUserMedia(42L, false, false);

        assertThat(result.get("userId")).isEqualTo(42L);
        assertThat(result.get("totalUploaded")).isEqualTo(2);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> files = (List<Map<String, Object>>) result.get("files");
        assertThat(files).hasSize(2);
        assertThat(files.get(0).get("fileKey")).isEqualTo("uploads/42/pic2.jpg");
        assertThat(files.get(0).get("accessUrl")).isEqualTo("http://localhost:9000/socialflow-media/uploads/42/pic2.jpg");
    }
}
