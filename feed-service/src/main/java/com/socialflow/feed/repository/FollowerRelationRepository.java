package com.socialflow.feed.repository;

import com.socialflow.feed.model.FollowerRelation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FollowerRelationRepository extends JpaRepository<FollowerRelation, Long> {
    List<FollowerRelation> findByFollowerId(Long followerId);
    boolean existsByFollowerIdAndFollowingId(Long followerId, Long followingId);
}