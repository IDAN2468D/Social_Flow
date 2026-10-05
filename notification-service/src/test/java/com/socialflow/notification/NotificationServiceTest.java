package com.socialflow.notification;

import com.socialflow.notification.dto.NotificationResponseDto;
import com.socialflow.notification.dto.UnreadCountDto;
import com.socialflow.notification.model.Notification;
import com.socialflow.notification.model.NotificationType;
import com.socialflow.notification.repository.NotificationRepository;
import com.socialflow.notification.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @InjectMocks
    private NotificationService notificationService;

    private Notification testNotification;

    @BeforeEach
    void setUp() {
        testNotification = Notification.builder()
                .id(1L)
                .recipientId(100L)
                .actorId(200L)
                .type(NotificationType.LIKE)
                .entityId(50L)
                .message("משתמש bob סימן לייק לפוסט שלך")
                .isRead(false)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("Should fetch notifications for user ordered by creation date desc")
    void testGetNotificationsForUser() {
        when(notificationRepository.findByRecipientIdOrderByCreatedAtDesc(100L))
                .thenReturn(List.of(testNotification));

        List<NotificationResponseDto> result = notificationService.getNotificationsForUser(100L);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getMessage()).isEqualTo("משתמש bob סימן לייק לפוסט שלך");
        assertThat(result.get(0).getRecipientId()).isEqualTo(100L);
    }

    @Test
    @DisplayName("Should return unread notifications count")
    void testGetUnreadCount() {
        when(notificationRepository.countByRecipientIdAndIsReadFalse(100L)).thenReturn(5L);

        UnreadCountDto result = notificationService.getUnreadCount(100L);

        assertThat(result.getUnreadCount()).isEqualTo(5L);
    }

    @Test
    @DisplayName("Should mark a single notification as read")
    void testMarkAsRead() {
        when(notificationRepository.findById(1L)).thenReturn(Optional.of(testNotification));
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> invocation.getArgument(0));

        NotificationResponseDto result = notificationService.markAsRead(1L, 100L);

        assertThat(result.getIsRead()).isTrue();
        verify(notificationRepository).save(any(Notification.class));
    }

    @Test
    @DisplayName("Self-action filter: should not create notification when actorId equals recipientId")
    void testSelfActionFilter() {
        NotificationResponseDto result = notificationService.createAndSendNotification(
                100L,
                100L, // Actor is also Recipient
                NotificationType.LIKE,
                50L,
                "משתמש alice סימן לייק לפוסט שלך"
        );

        assertThat(result).isNull();
        verify(notificationRepository, never()).save(any());
        verify(messagingTemplate, never()).convertAndSend(anyString(), any(Object.class));
    }

    @Test
    @DisplayName("Should create and broadcast notification when actorId differs from recipientId")
    void testCreateAndSendNotificationSuccess() {
        when(notificationRepository.save(any(Notification.class))).thenAnswer(invocation -> {
            Notification n = invocation.getArgument(0);
            n.setId(10L);
            return n;
        });

        NotificationResponseDto result = notificationService.createAndSendNotification(
                100L,
                200L,
                NotificationType.FOLLOW,
                200L,
                "משתמש bob התחיל לעקוב אחריך"
        );

        assertThat(result).isNotNull();
        assertThat(result.getRecipientId()).isEqualTo(100L);
        verify(notificationRepository, times(1)).save(any(Notification.class));
        verify(messagingTemplate, times(1)).convertAndSend(eq("/topic/user.100.notifications"), any(Object.class));
    }
}