package com.socialflow.user.repository;

import com.socialflow.user.model.Follower;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FollowerRepository extends JpaRepository<Follower, Long> {

    boolean existsByFollowerIdAndFollowingId(Long followerId, Long followingId);

    Optional<Follower> findByFollowerIdAndFollowingId(Long followerId, Long followingId);

    long countByFollowingId(Long followingId); // כמות עוקבים

    long countByFollowerId(Long followerId); // כמות נעקבים

    // שליפת רשימת המזהים של כל המשתמשים שהמשתמש עוקב אחריהם (קריטי להרכבת הפיד!)
    @Query("SELECT f.followingId FROM Follower f WHERE f.followerId = :followerId")
    List<Long> findFollowingIdsByFollowerId(@Param("followerId") Long followerId);
}