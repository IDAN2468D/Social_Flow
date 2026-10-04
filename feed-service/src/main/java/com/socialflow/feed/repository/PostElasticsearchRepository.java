package com.socialflow.feed.repository;

import com.socialflow.feed.document.PostDocument;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PostElasticsearchRepository extends ElasticsearchRepository<PostDocument, String> {
    Optional<PostDocument> findByPostId(Long postId);
    Page<PostDocument> findByAuthorIdInOrderByCreatedAtDesc(List<Long> authorIds, Pageable pageable);
    Page<PostDocument> findByAuthorIdOrderByIsPinnedDescCreatedAtDesc(Long authorId, Pageable pageable);
    Page<PostDocument> findAllByOrderByLikesCountDesc(Pageable pageable);
    Page<PostDocument> findAllByOrderByCreatedAtDesc(Pageable pageable);
    Page<PostDocument> findByContentContainingIgnoreCase(String query, Pageable pageable);
    Page<PostDocument> findByTagsContaining(String tag, Pageable pageable);
}