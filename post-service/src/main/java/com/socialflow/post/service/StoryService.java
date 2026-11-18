package com.socialflow.post.service;

import com.socialflow.post.dto.CreateStoryRequest;
import com.socialflow.post.dto.StoryResponseDto;
import com.socialflow.post.model.Story;
import com.socialflow.post.repository.StoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StoryService {

    private final StoryRepository storyRepository;

    public List<StoryResponseDto> getActiveStories() {
        return storyRepository.findByExpiresAtAfterOrderByCreatedAtDesc(LocalDateTime.now())
                .stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public StoryResponseDto createStory(CreateStoryRequest request, Long userId, String username) {
        LocalDateTime now = LocalDateTime.now();
        Story story = Story.builder()
                .userId(userId)
                .username(username)
                .userAvatar(request.getUserAvatar())
                .mediaUrl(request.getMediaUrl())
                .caption(request.getCaption())
                .createdAt(now)
                .expiresAt(now.plusHours(24))
                .build();

        Story saved = storyRepository.save(story);
        return mapToDto(saved);
    }

    private StoryResponseDto mapToDto(Story story) {
        return StoryResponseDto.builder()
                .id(story.getId())
                .userId(story.getUserId())
                .username(story.getUsername())
                .userAvatar(story.getUserAvatar())
                .mediaUrl(story.getMediaUrl())
                .caption(story.getCaption())
                .createdAt(story.getCreatedAt())
                .expiresAt(story.getExpiresAt())
                .build();
    }
}
