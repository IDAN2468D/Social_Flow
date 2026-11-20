package com.socialflow.user.service;

import com.socialflow.user.dto.UpdateProfileRequest;
import com.socialflow.user.dto.UserProfileDto;
import com.socialflow.user.event.UserFollowedEvent;
import com.socialflow.user.model.Follower;
import com.socialflow.user.model.User;
import com.socialflow.user.repository.FollowerRepository;
import com.socialflow.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

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

        User currentUser = resolveOptionalUser(currentUsername);
        return buildProfileDto(targetUser, currentUser);
    }

    @Transactional
    public void followUser(Long targetUserId, String currentUsername) {
        User currentUser = findActingUser(currentUsername);

        if (currentUser.getId().equals(targetUserId)) {
            throw new IllegalArgumentException("לא ניתן לעקוב אחרי עצמך");
        }

        if (!userRepository.existsById(targetUserId)) {
            throw new IllegalArgumentException("המשתמש המבוקש למעקב לא קיים");
        }

        persistFollowAndEmit(currentUser, targetUserId);
    }

    /**
     * Follow a target user resolved by either numeric user ID or username.
     */
    @Transactional
    public void followUser(String targetIdentifier, String currentUsername) {
        User currentUser = findActingUser(currentUsername);
        User targetUser = resolveTargetUser(targetIdentifier);

        if (currentUser.getId().equals(targetUser.getId())) {
            throw new IllegalArgumentException("לא ניתן לעקוב אחרי עצמך");
        }

        persistFollowAndEmit(currentUser, targetUser.getId());
    }

    @Transactional
    public void unfollowUser(Long targetUserId, String currentUsername) {
        User currentUser = findActingUser(currentUsername);
        deleteFollowAndEmit(currentUser, targetUserId);
    }

    /**
     * Unfollow a target user resolved by either numeric user ID or username.
     */
    @Transactional
    public void unfollowUser(String targetIdentifier, String currentUsername) {
        User currentUser = findActingUser(currentUsername);
        User targetUser = resolveTargetUser(targetIdentifier);
        deleteFollowAndEmit(currentUser, targetUser.getId());
    }

    /**
     * Update profile details for the authenticated user and return the updated DTO.
     */
    @Transactional
    public UserProfileDto updateProfile(String username, UpdateProfileRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("נתוני עדכון פרופיל חסרים");
        }
        return updateProfile(username, request.getFullName(), request.getBio(), request.getProfileImageUrl());
    }

    /**
     * Update profile fields for the authenticated user and return the updated DTO.
     */
    @Transactional
    public UserProfileDto updateProfile(String username, String fullName, String bio, String profileImageUrl) {
        User user = findActingUser(username);

        if (fullName != null) {
            user.setFullName(fullName.trim());
        }
        if (bio != null) {
            user.setBio(bio.trim());
        }
        if (profileImageUrl != null) {
            user.setProfileImageUrl(profileImageUrl.trim());
        }

        User savedUser = userRepository.save(user);
        eventProducer.emitUserProfileUpdated(savedUser.getId(), savedUser.getUsername(), savedUser.getFullName(), savedUser.getBio());
        return buildProfileDto(savedUser, savedUser);
    }

    /**
     * Search users by username or full name (case-insensitive substring match).
     */
    @Transactional(readOnly = true)
    public List<UserProfileDto> searchUsers(String query, String currentUsername) {
        User currentUser = resolveOptionalUser(currentUsername);
        String trimmed = query == null ? "" : query.trim();
        List<User> matches = trimmed.isEmpty()
                ? userRepository.findAll()
                : userRepository.findByUsernameContainingIgnoreCaseOrFullNameContainingIgnoreCase(trimmed, trimmed);

        return matches.stream()
                .limit(20)
                .map(user -> buildProfileDto(user, currentUser))
                .collect(Collectors.toList());
    }

    public List<Long> getFollowingIds(Long userId) {
        return followerRepository.findFollowingIdsByFollowerId(userId);
    }

    @Transactional
    public UserProfileDto updateUserRole(String targetIdentifier, String newRole) {
        if (newRole == null || newRole.isBlank()) {
            throw new IllegalArgumentException("תפקיד לא תקין");
        }
        String normalized = newRole.trim().toUpperCase();
        if (normalized.startsWith("ROLE_")) {
            normalized = normalized.substring(5);
        }
        if (!"USER".equals(normalized) && !"ADMIN".equals(normalized)) {
            throw new IllegalArgumentException("תפקיד חוקי הוא USER או ADMIN בלבד");
        }
        User targetUser = resolveTargetUser(targetIdentifier);
        targetUser.setRole(normalized);
        User saved = userRepository.save(targetUser);
        return buildProfileDto(saved, null);
    }

    private User findActingUser(String currentUsername) {
        if (currentUsername == null || currentUsername.isBlank()) {
            throw new IllegalArgumentException("המשתמש המחובר לא נמצא");
        }
        return userRepository.findByUsername(currentUsername.trim())
                .orElseThrow(() -> new IllegalArgumentException("המשתמש המחובר לא נמצא"));
    }

    private User resolveOptionalUser(String username) {
        if (username == null || username.isBlank()) {
            return null;
        }
        return userRepository.findByUsername(username.trim()).orElse(null);
    }

    private User resolveTargetUser(String targetIdentifier) {
        if (targetIdentifier == null || targetIdentifier.isBlank()) {
            throw new IllegalArgumentException("מזהה המשתמש המבוקש אינו תקין");
        }
        String trimmed = targetIdentifier.trim();
        if (trimmed.chars().allMatch(Character::isDigit)) {
            try {
                Long targetUserId = Long.parseLong(trimmed);
                Optional<User> byId = userRepository.findById(targetUserId);
                if (byId.isPresent()) {
                    return byId.get();
                }
            } catch (NumberFormatException ignored) {
                // Fall back to username lookup when numeric value overflows Long
            }
        }
        return userRepository.findByUsername(trimmed)
                .orElseThrow(() -> new IllegalArgumentException("המשתמש המבוקש למעקב לא קיים"));
    }

    private void persistFollowAndEmit(User currentUser, Long targetUserId) {
        if (!followerRepository.existsByFollowerIdAndFollowingId(currentUser.getId(), targetUserId)) {
            Follower follower = new Follower(currentUser.getId(), targetUserId);
            followerRepository.save(follower);

            // שידור אירוע מעקב ל-Kafka
            eventProducer.emitUserFollowed(new UserFollowedEvent(currentUser.getId(), currentUser.getUsername(), targetUserId, true));
        }
    }

    private void deleteFollowAndEmit(User currentUser, Long targetUserId) {
        followerRepository.findByFollowerIdAndFollowingId(currentUser.getId(), targetUserId)
                .ifPresent(f -> {
                    followerRepository.delete(f);
                    // שידור אירוע ביטול מעקב ל-Kafka
                    eventProducer.emitUserFollowed(new UserFollowedEvent(currentUser.getId(), currentUser.getUsername(), targetUserId, false));
                });
    }

    private UserProfileDto buildProfileDto(User targetUser, User currentUser) {
        UserProfileDto dto = new UserProfileDto();
        dto.setId(targetUser.getId());
        dto.setUsername(targetUser.getUsername());
        dto.setEmail(targetUser.getEmail());
        dto.setFullName(targetUser.getFullName());
        dto.setBio(targetUser.getBio());
        dto.setProfileImageUrl(targetUser.getProfileImageUrl());
        dto.setRole(targetUser.getRole());
        dto.setFollowersCount(followerRepository.countByFollowingId(targetUser.getId()));
        dto.setFollowingCount(followerRepository.countByFollowerId(targetUser.getId()));

        if (currentUser != null) {
            boolean isFollowing = followerRepository.existsByFollowerIdAndFollowingId(currentUser.getId(), targetUser.getId());
            dto.setFollowedByCurrentUser(isFollowing);
        }

        return dto;
    }
}