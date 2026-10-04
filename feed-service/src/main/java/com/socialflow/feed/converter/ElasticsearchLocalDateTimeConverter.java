package com.socialflow.feed.converter;

import org.springframework.data.elasticsearch.core.mapping.PropertyValueConverter;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public class ElasticsearchLocalDateTimeConverter implements PropertyValueConverter {

    private static final DateTimeFormatter FORMATTER = DateTimeFormatter.ofPattern("uuuu-MM-dd'T'HH:mm:ss.SSS");

    @Override
    public Object write(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDateTime ldt) {
            return ldt.format(FORMATTER);
        }
        return value.toString();
    }

    @Override
    public Object read(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof LocalDateTime ldt) {
            return ldt;
        }
        String str = value.toString().trim();
        if (str.isEmpty()) {
            return null;
        }

        // Date-only: e.g. "2026-10-04"
        if (str.length() == 10) {
            try {
                return LocalDate.parse(str).atStartOfDay();
            } catch (Exception ignored) {
            }
        }

        // Standard LocalDateTime: e.g. "2026-10-04T11:52:43.342" or without millis
        try {
            return LocalDateTime.parse(str);
        } catch (Exception ignored) {
        }

        // OffsetDateTime: e.g. "2026-10-04T11:52:43.342+03:00"
        try {
            return OffsetDateTime.parse(str).toLocalDateTime();
        } catch (Exception ignored) {
        }

        // UTC with Z / Instant: e.g. "2026-10-04T11:52:43.342Z"
        try {
            return Instant.parse(str).atZone(ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception ignored) {
        }

        // Numeric epoch millis: e.g. 1728033283000
        try {
            long epochMillis = Long.parseLong(str);
            return Instant.ofEpochMilli(epochMillis).atZone(ZoneId.systemDefault()).toLocalDateTime();
        } catch (Exception ignored) {
        }

        return LocalDateTime.parse(str);
    }
}
