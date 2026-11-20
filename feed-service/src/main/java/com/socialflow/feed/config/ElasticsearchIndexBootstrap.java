package com.socialflow.feed.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.IndexOperations;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class ElasticsearchIndexBootstrap {

    public static final String POSTS_INDEX = "posts";

    private static final String SETTINGS_JSON = """
            {
              "index": {
                "number_of_shards": 1,
                "number_of_replicas": 0
              }
            }
            """;

    /**
     * Elasticsearch 8.13 Basic-compatible mapping with 768-dim int8_hnsw cosine dense_vector.
     */
    private static final String MAPPING_JSON = """
            {
              "properties": {
                "id": { "type": "keyword" },
                "postId": { "type": "long" },
                "authorId": { "type": "long" },
                "authorUsername": { "type": "keyword" },
                "authorAvatar": { "type": "keyword" },
                "content": { "type": "text", "analyzer": "standard" },
                "mediaUrls": { "type": "keyword" },
                "tags": { "type": "keyword" },
                "aiTags": { "type": "keyword" },
                "mentions": { "type": "keyword" },
                "sentiment": { "type": "keyword" },
                "aiSummary": { "type": "text", "analyzer": "standard" },
                "aiCategory": { "type": "keyword" },
                "moderationStatus": { "type": "keyword" },
                "moderationReason": { "type": "keyword" },
                "likesCount": { "type": "integer" },
                "commentsCount": { "type": "integer" },
                "repostsCount": { "type": "integer" },
                "hasPoll": { "type": "boolean" },
                "isRepost": { "type": "boolean" },
                "originalPostId": { "type": "long" },
                "isPinned": { "type": "boolean" },
                "visibility": { "type": "keyword" },
                "hidden": { "type": "boolean" },
                "engagementScore": { "type": "double" },
                "embedding": {
                  "type": "dense_vector",
                  "dims": 768,
                  "index": true,
                  "similarity": "cosine",
                  "index_options": {
                    "type": "int8_hnsw"
                  }
                },
                "createdAt": {
                  "type": "date",
                  "format": "strict_date_optional_time||epoch_millis"
                }
              }
            }
            """;

    private final ElasticsearchOperations elasticsearchOperations;

    @Autowired
    public ElasticsearchIndexBootstrap(@Autowired(required = false) ElasticsearchOperations elasticsearchOperations) {
        this.elasticsearchOperations = elasticsearchOperations;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void ensurePostsIndexExists() {
        if (elasticsearchOperations == null) {
            return;
        }
        try {
            IndexOperations indexOps = elasticsearchOperations.indexOps(IndexCoordinates.of(POSTS_INDEX));
            Document mappingDoc = Document.parse(MAPPING_JSON);
            if (!indexOps.exists()) {
                Document settingsDoc = Document.parse(SETTINGS_JSON);
                boolean created = indexOps.create(settingsDoc, mappingDoc);
                log.info("Elasticsearch '{}' index created (ES 8.13 Basic + int8_hnsw 768d): {}", POSTS_INDEX, created);
            } else {
                indexOps.putMapping(mappingDoc);
                log.info("Elasticsearch '{}' index mapping verified/updated", POSTS_INDEX);
            }
        } catch (Exception e) {
            log.warn("Elasticsearch '{}' index bootstrap skipped (ES unavailable or incompatible): {}",
                    POSTS_INDEX, e.getMessage());
        }
    }

    public static Document buildSettingsDocument() {
        return Document.parse(SETTINGS_JSON);
    }

    public static Document buildMappingDocument() {
        return Document.parse(MAPPING_JSON);
    }
}
