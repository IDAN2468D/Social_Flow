package com.socialflow.notification.repository;

import com.socialflow.notification.model.NotificationProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface NotificationProcessedEventRepository extends JpaRepository<NotificationProcessedEvent, String> {
}
