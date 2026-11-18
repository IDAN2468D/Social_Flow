package com.socialflow.gateway.exception;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.reactive.error.ErrorWebExceptionHandler;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Centralized error manager for Spring Cloud API Gateway returning structured JSON errors.
 */
@Component
@Order(-2)
public class GatewayExceptionHandler implements ErrorWebExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GatewayExceptionHandler.class);
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, Throwable ex) {
        ServerHttpResponse response = exchange.getResponse();
        if (response.isCommitted()) {
            return Mono.error(ex);
        }

        HttpStatusCode statusCode = HttpStatus.BAD_GATEWAY;
        String message = ex.getMessage() != null ? ex.getMessage() : "Gateway upstream error";
        if (ex instanceof ResponseStatusException rse) {
            statusCode = rse.getStatusCode();
            message = rse.getReason() != null ? rse.getReason() : message;
        }

        HttpStatus resolved = HttpStatus.resolve(statusCode.value());
        String errorPhrase = resolved != null ? resolved.getReasonPhrase() : "Gateway Error";
        String path = exchange.getRequest().getURI().getPath();

        log.error("Gateway error on {}: [{}] {}", path, statusCode.value(), message);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", statusCode.value());
        body.put("error", errorPhrase);
        body.put("message", message);
        body.put("path", path);

        byte[] bytes;
        try {
            bytes = objectMapper.writeValueAsBytes(body);
        } catch (JsonProcessingException jsonEx) {
            bytes = ("{\"status\":" + statusCode.value() + ",\"error\":\"" + errorPhrase + "\"}")
                    .getBytes(StandardCharsets.UTF_8);
        }

        response.setStatusCode(statusCode);
        response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
        DataBuffer buffer = response.bufferFactory().wrap(bytes);
        return response.writeWith(Mono.just(buffer));
    }
}
