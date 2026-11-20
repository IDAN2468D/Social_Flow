package com.socialflow.feed.repository;

import com.socialflow.feed.model.FeedProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FeedProcessedEventRepository extends JpaRepository<FeedProcessedEvent, String> {
}
