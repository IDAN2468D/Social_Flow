package com.socialflow.feed.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrendingTagDto {
    private String tag;
    private long count;
    private String category;
}