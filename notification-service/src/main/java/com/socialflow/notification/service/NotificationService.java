package com.socialflow.notification.service;

import com.socialflow.notification.dto.NotificationResponseDto;
import com.socialflow.notification.dto.UnreadCountDto;
import com.socialflow.notification.model.Notification;
import com.socialflow.notification.model.NotificationType;
import com.socialflow.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Transactional(readOnly = true)
    public List<NotificationResponseDto> getNotificationsForUser(Long recipientId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(recipientId)
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public UnreadCountDto getUnreadCount(Long recipientId) {
        long count = notificationRepository.countByRecipientIdAndIsReadFalse(recipientId);
        return UnreadCountDto.builder().unreadCount(count).build();
    }

    @Transactional
    public NotificationResponseDto markAsRead(Long notificationId, Long recipientId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new IllegalArgumentException("Notification not found with id: " + notificationId));

        if (!notification.getRecipientId().equals(recipientId)) {
            throw new AccessDeniedException("Not authorized to access this notification");
        }

        notification.setIsRead(true);
        Notification saved = notificationRepository.save(notification);
        return mapToDto(saved);
    }

    @Transactional
    public void markAllAsRead(Long recipientId) {
        notificationRepository.markAllAsReadByRecipientId(recipientId);
    }

    @Transactional
    public NotificationResponseDto createAndSendNotification(
            Long recipientId,
            Long actorId,
            NotificationType type,
            Long entityId,
            String message
    ) {
        // מנגנון סינון פעולה עצמית (Self-Action Filter): משתמש אינו מקבל התראה על פעולה של עצמו
        if (actorId != null && actorId.equals(recipientId)) {
            log.info("Self-action detected: actorId {} equals recipientId {}. Notification filtered.", actorId, recipientId);
            return null;
        }

        Notification notification = Notification.builder()
                .recipientId(recipientId)
                .actorId(actorId)
                .type(type)
                .entityId(entityId)
                .message(message)
                .isRead(false)
                .createdAt(LocalDateTime.now())
                .build();

        Notification saved = notificationRepository.save(notification);
        NotificationResponseDto dto = mapToDto(saved);

        // שידור חי לדפדפן הלקוח בערוץ הפרטי שלו
        String destination = "/topic/user." + recipientId + ".notifications";
        try {
            messagingTemplate.convertAndSend(destination, dto);
            log.info("Pushed notification {} to destination {}", saved.getId(), destination);
        } catch (Exception e) {
            log.error("Failed to push notification via WebSocket: {}", e.getMessage(), e);
        }

        return dto;
    }

    private NotificationResponseDto mapToDto(Notification n) {
        return NotificationResponseDto.builder()
                .id(n.getId())
                .recipientId(n.getRecipientId())
                .actorId(n.getActorId())
                .type(n.getType())
                .entityId(n.getEntityId())
                .message(n.getMessage())
                .isRead(n.getIsRead())
                .createdAt(n.getCreatedAt())
                .build();
    }
}