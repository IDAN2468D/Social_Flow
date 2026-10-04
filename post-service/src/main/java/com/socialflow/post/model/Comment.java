package com.socialflow.post.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "post_comments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Comment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long postId;

    @Column(name = "author_id", nullable = false)
    private Long authorId;

    @Column(name = "author_username", nullable = false)
    private String authorUsername;

    @Column(name = "author_avatar")
    private String authorAvatar;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Builder.Default
    @Column(nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    public Comment(Long postId, Long authorId, String authorUsername, String content) {
        this.postId = postId;
        this.authorId = authorId;
        this.authorUsername = authorUsername;
        this.content = content;
        this.createdAt = LocalDateTime.now();
    }

    public Long getUserId() { return authorId; }
    public void setUserId(Long userId) { this.authorId = userId; }

    public String getUsername() { return authorUsername; }
    public void setUsername(String username) { this.authorUsername = username; }
}