package com.socialflow.post.repository;

import com.socialflow.post.model.PostOutboxEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostOutboxEventRepository extends JpaRepository<PostOutboxEvent, Long> {

    @Query(
            value = "SELECT * FROM post_outbox_events WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT :batchSize FOR UPDATE SKIP LOCKED",
            nativeQuery = true
    )
    List<PostOutboxEvent> findPendingBatchForUpdate(@Param("batchSize") int batchSize);

    List<PostOutboxEvent> findTop50ByStatusOrderByCreatedAtAsc(PostOutboxEvent.OutboxStatus status);

    long countByStatus(PostOutboxEvent.OutboxStatus status);
}
