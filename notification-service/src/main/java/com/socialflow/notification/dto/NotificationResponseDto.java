package com.socialflow.notification.dto;

import com.socialflow.notification.model.NotificationType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationResponseDto {
    private Long id;
    private Long recipientId;
    private Long actorId;
    private NotificationType type;
    private Long entityId;
    private String message;
    private Boolean isRead;
    private LocalDateTime createdAt;
}