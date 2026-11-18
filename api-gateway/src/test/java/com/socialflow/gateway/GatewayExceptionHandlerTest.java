package com.socialflow.gateway;

import com.socialflow.gateway.exception.GatewayExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GatewayExceptionHandlerTest {

    private final GatewayExceptionHandler handler = new GatewayExceptionHandler();

    @Test
    void handlesResponseStatusExceptionAsJson() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.get("/api/v1/posts/999").build()
        );

        handler.handle(exchange, new ResponseStatusException(HttpStatus.NOT_FOUND, "Route missing")).block();

        assertEquals(HttpStatus.NOT_FOUND, exchange.getResponse().getStatusCode());
        assertEquals(MediaType.APPLICATION_JSON, exchange.getResponse().getHeaders().getContentType());
        String body = exchange.getResponse().getBodyAsString().block();
        assertTrue(body != null && body.contains("\"status\":404") && body.contains("/api/v1/posts/999"));
    }

    @Test
    void handlesUpstreamFailureAs502Json() {
        MockServerWebExchange exchange = MockServerWebExchange.from(
                MockServerHttpRequest.post("/api/v1/posts").build()
        );

        handler.handle(exchange, new RuntimeException("Connection refused")).block();

        assertEquals(HttpStatus.BAD_GATEWAY, exchange.getResponse().getStatusCode());
        assertEquals(MediaType.APPLICATION_JSON, exchange.getResponse().getHeaders().getContentType());
        String body = exchange.getResponse().getBodyAsString().block();
        assertTrue(body != null && body.contains("\"status\":502") && body.contains("Connection refused"));
    }
}
