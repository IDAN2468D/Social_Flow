package com.socialflow.post.repository;

import com.socialflow.post.model.PostReaction;
import com.socialflow.post.model.ReactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PostReactionRepository extends JpaRepository<PostReaction, Long> {
    Optional<PostReaction> findByPostIdAndUserId(Long postId, Long userId);
    List<PostReaction> findByPostId(Long postId);
    long countByPostIdAndReactionType(Long postId, ReactionType reactionType);
    void deleteByPostIdAndUserId(Long postId, Long userId);
}