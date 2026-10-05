package com.socialflow.media.service;

import com.socialflow.media.dto.UploadUrlRequest;
import com.socialflow.media.dto.UploadUrlResponse;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.util.UUID;

@Service
public class MediaService {

    private static final Logger log = LoggerFactory.getLogger(MediaService.class);

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String bucketName;
    private final String publicEndpoint;

    public MediaService(S3Client s3Client,
                        S3Presigner s3Presigner,
                        @Value("${aws.s3.bucket}") String bucketName,
                        @Value("${aws.s3.public-endpoint}") String publicEndpoint) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.bucketName = bucketName;
        this.publicEndpoint = publicEndpoint.replaceAll("/+$", "");
    }

    @PostConstruct
    public void initBucket() {
        // Run bucket initialization in a separate thread so startup is not blocked if MinIO is booting
        Thread initThread = new Thread(() -> {
            int maxRetries = 15;
            for (int i = 1; i <= maxRetries; i++) {
                try {
                    boolean exists = true;
                    try {
                        s3Client.headBucket(HeadBucketRequest.builder().bucket(bucketName).build());
                    } catch (NoSuchBucketException e) {
                        exists = false;
                    } catch (Exception e) {
                        exists = false;
                    }

                    if (!exists) {
                        log.info("Bucket '{}' not found. Creating it...", bucketName);
                        s3Client.createBucket(CreateBucketRequest.builder().bucket(bucketName).build());
                        log.info("Bucket '{}' created successfully.", bucketName);
                    } else {
                        log.info("Bucket '{}' already exists.", bucketName);
                    }

                    // Configure public read policy so browser can view images via accessUrl
                    String policy = """
                        {
                          "Version": "2012-10-17",
                          "Statement": [
                            {
                              "Sid": "PublicReadGetObject",
                              "Effect": "Allow",
                              "Principal": "*",
                              "Action": "s3:GetObject",
                              "Resource": "arn:aws:s3:::%s/*"
                            }
                          ]
                        }
                        """.formatted(bucketName);

                    try {
                        s3Client.putBucketPolicy(PutBucketPolicyRequest.builder()
                                .bucket(bucketName)
                                .policy(policy)
                                .build());
                        log.info("Public read policy configured on bucket '{}'.", bucketName);
                    } catch (Exception pe) {
                        log.warn("Could not set bucket policy on '{}': {}", bucketName, pe.getMessage());
                    }

                    // CORS Configuration for browser uploads
                    CORSRule corsRule = CORSRule.builder()
                            .allowedHeaders("*")
                            .allowedMethods("GET", "PUT", "POST", "HEAD", "DELETE")
                            .allowedOrigins("*")
                            .maxAgeSeconds(3600)
                            .build();

                    CORSConfiguration corsConfiguration = CORSConfiguration.builder()
                            .corsRules(corsRule)
                            .build();

                    try {
                        s3Client.putBucketCors(PutBucketCorsRequest.builder()
                                .bucket(bucketName)
                                .corsConfiguration(corsConfiguration)
                                .build());
                        log.info("CORS configuration configured on bucket '{}'.", bucketName);
                    } catch (Exception ce) {
                        log.warn("Could not set bucket CORS on '{}': {}", bucketName, ce.getMessage());
                    }

                    break;
                } catch (Exception e) {
                    if (i == maxRetries) {
                        log.error("Failed to initialize bucket '{}' after {} attempts: {}", bucketName, maxRetries, e.getMessage());
                    } else {
                        log.warn("MinIO not available yet on attempt {}/{}: {}. Retrying in 2 seconds...", i, maxRetries, e.getMessage());
                        try {
                            Thread.sleep(2000);
                        } catch (InterruptedException ignored) {
                            Thread.currentThread().interrupt();
                            break;
                        }
                    }
                }
            }
        });
        initThread.setName("minio-init-thread");
        initThread.setDaemon(true);
        initThread.start();
    }

    public UploadUrlResponse generateUploadUrl(Long userId, UploadUrlRequest request) {
        String extension = getFileExtension(request.filename());
        String fileKey = "uploads/" + userId + "/" + UUID.randomUUID() + extension;

        PutObjectRequest objectRequest = PutObjectRequest.builder()
                .bucket(bucketName)
                .key(fileKey)
                .contentType(request.contentType())
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofMinutes(15))
                .putObjectRequest(objectRequest)
                .build();

        PresignedPutObjectRequest presignedPutObjectRequest = s3Presigner.presignPutObject(presignRequest);

        return new UploadUrlResponse(
                fileKey,
                presignedPutObjectRequest.url().toString(),
                publicEndpoint + "/" + bucketName + "/" + fileKey
        );
    }

    private String getFileExtension(String filename) {
        if (filename == null) return "";
        int dotIndex = filename.lastIndexOf('.');
        return (dotIndex > 0) ? filename.substring(dotIndex) : "";
    }
}