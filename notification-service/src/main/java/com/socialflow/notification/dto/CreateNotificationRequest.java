package com.socialflow.notification.dto;

import com.socialflow.notification.model.NotificationType;
import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateNotificationRequest {
    private Long recipientId;
    private NotificationType type;
    private Long entityId;

    @NotBlank(message = "Notification message is required")
    private String message;
}
