package com.socialflow.user.repository;

import com.socialflow.user.model.UserOutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface UserOutboxEventRepository extends JpaRepository<UserOutboxEvent, Long> {

    @Query(
            value = "SELECT * FROM user_outbox_events WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT :batchSize FOR UPDATE SKIP LOCKED",
            nativeQuery = true
    )
    List<UserOutboxEvent> findPendingBatchForUpdate(@Param("batchSize") int batchSize);

    long countByStatus(UserOutboxEvent.OutboxStatus status);
}
