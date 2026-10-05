package com.socialflow.notification.controller;

import com.socialflow.notification.dto.NotificationResponseDto;
import com.socialflow.notification.dto.UnreadCountDto;
import com.socialflow.notification.security.UserPrincipal;
import com.socialflow.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Slf4j
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public ResponseEntity<List<NotificationResponseDto>> getNotifications(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        List<NotificationResponseDto> notifications = notificationService.getNotificationsForUser(principal.getUserId());
        return ResponseEntity.ok(notifications);
    }

    @GetMapping("/unread-count")
    public ResponseEntity<UnreadCountDto> getUnreadCount(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        UnreadCountDto countDto = notificationService.getUnreadCount(principal.getUserId());
        return ResponseEntity.ok(countDto);
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<NotificationResponseDto> markAsRead(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        NotificationResponseDto updated = notificationService.markAsRead(id, principal.getUserId());
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/read-all")
    public ResponseEntity<Void> markAllAsRead(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        notificationService.markAllAsRead(principal.getUserId());
        return ResponseEntity.noContent().build();
    }
}