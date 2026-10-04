package com.socialflow.feed.document;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.DateFormat;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;
import org.springframework.data.elasticsearch.annotations.ValueConverter;
import com.socialflow.feed.converter.ElasticsearchLocalDateTimeConverter;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@Document(indexName = "posts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostDocument {

    @Id
    private String id;

    @Field(type = FieldType.Long)
    private Long postId;

    @Field(type = FieldType.Long)
    private Long authorId;

    @Field(type = FieldType.Keyword)
    private String authorUsername;

    @Field(type = FieldType.Keyword)
    private String authorAvatar;

    @Field(type = FieldType.Text, analyzer = "standard")
    private String content;

    @Field(type = FieldType.Keyword)
    private List<String> mediaUrls;

    @Field(type = FieldType.Keyword)
    private List<String> tags;

    @Field(type = FieldType.Keyword)
    private Set<String> mentions;

    @Field(type = FieldType.Integer)
    private int likesCount;

    @Field(type = FieldType.Integer)
    private int commentsCount;

    @Field(type = FieldType.Integer)
    private int repostsCount;

    @Field(type = FieldType.Boolean)
    private boolean hasPoll;

    @Field(type = FieldType.Boolean)
    private boolean isRepost;

    @Field(type = FieldType.Long)
    private Long originalPostId;

    @Field(type = FieldType.Boolean)
    private boolean isPinned;

    @Field(type = FieldType.Keyword)
    private String visibility;

    @Field(type = FieldType.Double)
    private double engagementScore;

    @Field(type = FieldType.Date, format = {DateFormat.date_hour_minute_second_millis, DateFormat.epoch_millis})
    @ValueConverter(ElasticsearchLocalDateTimeConverter.class)
    private LocalDateTime createdAt;
}