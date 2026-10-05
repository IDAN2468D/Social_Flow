package com.socialflow.user.event;

import java.io.Serializable;
import java.time.LocalDateTime;

public class UserFollowedEvent implements Serializable {

    private Long followerId;
    private String followerUsername;
    private Long followingId;
    private boolean isFollow; // true = follow, false = unfollow
    private LocalDateTime timestamp;

    public UserFollowedEvent() {}

    public UserFollowedEvent(Long followerId, Long followingId, boolean isFollow) {
        this.followerId = followerId;
        this.followingId = followingId;
        this.isFollow = isFollow;
        this.timestamp = LocalDateTime.now();
    }

    public UserFollowedEvent(Long followerId, String followerUsername, Long followingId, boolean isFollow) {
        this.followerId = followerId;
        this.followerUsername = followerUsername;
        this.followingId = followingId;
        this.isFollow = isFollow;
        this.timestamp = LocalDateTime.now();
    }

    public Long getFollowerId() { return followerId; }
    public void setFollowerId(Long followerId) { this.followerId = followerId; }

    public String getFollowerUsername() { return followerUsername; }
    public void setFollowerUsername(String followerUsername) { this.followerUsername = followerUsername; }

    public Long getFollowingId() { return followingId; }
    public void setFollowingId(Long followingId) { this.followingId = followingId; }

    public boolean isFollow() { return isFollow; }
    public void setFollow(boolean follow) { isFollow = follow; }

    public LocalDateTime getTimestamp() { return timestamp; }
    public void setTimestamp(LocalDateTime timestamp) { this.timestamp = timestamp; }
}