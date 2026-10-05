package com.socialflow.user.service;

import com.socialflow.user.dto.UserProfileDto;
import com.socialflow.user.event.UserFollowedEvent;
import com.socialflow.user.model.Follower;
import com.socialflow.user.model.User;
import com.socialflow.user.repository.FollowerRepository;
import com.socialflow.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final FollowerRepository followerRepository;
    private final UserEventProducer eventProducer;

    public UserService(UserRepository userRepository,
                       FollowerRepository followerRepository,
                       UserEventProducer eventProducer) {
        this.userRepository = userRepository;
        this.followerRepository = followerRepository;
        this.eventProducer = eventProducer;
    }

    public UserProfileDto getProfile(String targetUsername, String currentUsername) {
        User targetUser = userRepository.findByUsername(targetUsername)
                .orElseThrow(() -> new IllegalArgumentException("המשתמש " + targetUsername + " לא נמצא"));

        UserProfileDto dto = new UserProfileDto();
        dto.setId(targetUser.getId());
        dto.setUsername(targetUser.getUsername());
        dto.setEmail(targetUser.getEmail());
        dto.setFullName(targetUser.getFullName());
        dto.setBio(targetUser.getBio());
        dto.setProfileImageUrl(targetUser.getProfileImageUrl());
        dto.setFollowersCount(followerRepository.countByFollowingId(targetUser.getId()));
        dto.setFollowingCount(followerRepository.countByFollowerId(targetUser.getId()));

        if (currentUsername != null) {
            userRepository.findByUsername(currentUsername).ifPresent(curr -> {
                boolean isFollowing = followerRepository.existsByFollowerIdAndFollowingId(curr.getId(), targetUser.getId());
                dto.setFollowedByCurrentUser(isFollowing);
            });
        }

        return dto;
    }

    @Transactional
    public void followUser(Long targetUserId, String currentUsername) {
        User currentUser = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new IllegalArgumentException("המשתמש המחובר לא נמצא"));

        if (currentUser.getId().equals(targetUserId)) {
            throw new IllegalArgumentException("לא ניתן לעקוב אחרי עצמך");
        }

        if (!userRepository.existsById(targetUserId)) {
            throw new IllegalArgumentException("המשתמש המבוקש למעקב לא קיים");
        }

        if (!followerRepository.existsByFollowerIdAndFollowingId(currentUser.getId(), targetUserId)) {
            Follower follower = new Follower(currentUser.getId(), targetUserId);
            followerRepository.save(follower);

            // שידור אירוע מעקב ל-Kafka
            eventProducer.emitUserFollowed(new UserFollowedEvent(currentUser.getId(), currentUser.getUsername(), targetUserId, true));
        }
    }

    @Transactional
    public void unfollowUser(Long targetUserId, String currentUsername) {
        User currentUser = userRepository.findByUsername(currentUsername)
                .orElseThrow(() -> new IllegalArgumentException("המשתמש המחובר לא נמצא"));

        followerRepository.findByFollowerIdAndFollowingId(currentUser.getId(), targetUserId)
                .ifPresent(f -> {
                    followerRepository.delete(f);
                    // שידור אירוע ביטול מעקב ל-Kafka
                    eventProducer.emitUserFollowed(new UserFollowedEvent(currentUser.getId(), targetUserId, false));
                });
    }

    public List<Long> getFollowingIds(Long userId) {
        return followerRepository.findFollowingIdsByFollowerId(userId);
    }
}