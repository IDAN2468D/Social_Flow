package com.socialflow.feed.consumer;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialflow.feed.document.PostDocument;
import com.socialflow.feed.model.FollowerRelation;
import com.socialflow.feed.repository.FollowerRelationRepository;
import com.socialflow.feed.repository.PostElasticsearchRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class FeedKafkaConsumer {

    private final PostElasticsearchRepository postSearchRepository;
    private final FollowerRelationRepository followerRelationRepository;
    private final ObjectMapper objectMapper;

    @KafkaListener(topics = "post-events", groupId = "feed-service-group")
    public void consumePostEvent(String message) {
        log.info("Received post event: {}", message);
        try {
            JsonNode node = objectMapper.readTree(message);

            if (node.has("postId") && node.has("content")) {
                Long postId = node.get("postId").asLong();
                Long authorId = node.get("authorId").asLong();
                String authorUsername = node.get("authorUsername").asText();
                String content = node.get("content").asText();

                List<String> tags = new ArrayList<>();
                if (node.has("tags")) {
                    node.get("tags").forEach(t -> tags.add(t.asText()));
                }

                List<String> mediaUrls = new ArrayList<>();
                if (node.has("mediaUrls")) {
                    node.get("mediaUrls").forEach(m -> mediaUrls.add(m.asText()));
                }

                Set<String> mentions = new HashSet<>();
                if (node.has("mentions")) {
                    node.get("mentions").forEach(m -> mentions.add(m.asText()));
                }

                boolean hasPoll = node.has("hasPoll") && node.get("hasPoll").asBoolean();
                boolean isRepost = node.has("isRepost") && node.get("isRepost").asBoolean();
                Long originalPostId = node.has("originalPostId") && !node.get("originalPostId").isNull() ? node.get("originalPostId").asLong() : null;
                String visibility = node.has("visibility") ? node.get("visibility").asText() : "PUBLIC";

                LocalDateTime createdAt = LocalDateTime.now();
                if (node.has("createdAt") && !node.get("createdAt").isNull()) {
                    try {
                        createdAt = LocalDateTime.parse(node.get("createdAt").asText());
                    } catch (Exception e) {
                        log.warn("Could not parse createdAt from event: {}, falling back to now()", node.get("createdAt").asText());
                    }
                }

                PostDocument doc = PostDocument.builder()
                        .id(postId.toString())
                        .postId(postId)
                        .authorId(authorId)
                        .authorUsername(authorUsername)
                        .content(content)
                        .mediaUrls(mediaUrls)
                        .tags(tags)
                        .mentions(mentions)
                        .likesCount(0)
                        .commentsCount(0)
                        .repostsCount(0)
                        .hasPoll(hasPoll)
                        .isRepost(isRepost)
                        .originalPostId(originalPostId)
                        .isPinned(false)
                        .visibility(visibility)
                        .createdAt(createdAt)
                        .build();

                postSearchRepository.save(doc);
                log.info("Indexed post {} into Elasticsearch", postId);
            } else if (node.has("postId") && node.has("liked")) {
                Long postId = node.get("postId").asLong();
                boolean liked = node.get("liked").asBoolean();
                postSearchRepository.findByPostId(postId).ifPresent(doc -> {
                    int updatedLikes = liked ? doc.getLikesCount() + 1 : Math.max(0, doc.getLikesCount() - 1);
                    doc.setLikesCount(updatedLikes);
                    postSearchRepository.save(doc);
                });
            } else if (node.has("repostId") && node.has("originalPostId")) {
                Long originalPostId = node.get("originalPostId").asLong();
                postSearchRepository.findByPostId(originalPostId).ifPresent(doc -> {
                    doc.setRepostsCount(doc.getRepostsCount() + 1);
                    postSearchRepository.save(doc);
                });
            } else if (node.has("postId") && !node.has("content")) {
                Long postId = node.get("postId").asLong();
                postSearchRepository.findByPostId(postId).ifPresent(postSearchRepository::delete);
            }
        } catch (Exception e) {
            log.error("Error processing post event: {}", e.getMessage(), e);
        }
    }

    @KafkaListener(topics = "user-events", groupId = "feed-service-group")
    @Transactional
    public void consumeUserEvent(String message) {
        log.info("Received user event: {}", message);
        try {
            JsonNode node = objectMapper.readTree(message);
            if (node.has("followerId") && node.has("followingId")) {
                Long followerId = node.get("followerId").asLong();
                Long followingId = node.get("followingId").asLong();

                if (!followerRelationRepository.existsByFollowerIdAndFollowingId(followerId, followingId)) {
                    followerRelationRepository.save(FollowerRelation.builder()
                            .followerId(followerId)
                            .followingId(followingId)
                            .build());
                }
            }
        } catch (Exception e) {
            log.error("Error processing user event: {}", e.getMessage(), e);
        }
    }
}