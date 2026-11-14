package com.socialflow.user.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex, HttpServletRequest request) {
        String msg = ex.getMessage();
        HttpStatus status = HttpStatus.BAD_REQUEST;

        // Return 401 Unauthorized for invalid login credentials, otherwise 400 Bad Request
        if (msg != null && (msg.contains("שגויים") || msg.contains("סיסמה") || msg.contains("credentials"))) {
            status = HttpStatus.UNAUTHORIZED;
        }

        return buildResponse(status, msg, request.getRequestURI());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        StringBuilder sb = new StringBuilder();
        ex.getBindingResult().getFieldErrors().forEach(err -> {
            if (sb.length() > 0) sb.append(", ");
            sb.append(err.getDefaultMessage());
        });
        String msg = sb.length() > 0 ? sb.toString() : "שדות הטופס אינם תקינים";
        return buildResponse(HttpStatus.BAD_REQUEST, msg, request.getRequestURI());
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneralException(Exception ex, HttpServletRequest request) {
        String msg = ex.getMessage() != null ? ex.getMessage() : "אירעה שגיאה בשרת";
        return buildResponse(HttpStatus.INTERNAL_SERVER_ERROR, msg, request.getRequestURI());
    }

    private ResponseEntity<Map<String, Object>> buildResponse(HttpStatus status, String message, String path) {
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", Instant.now().toString());
        body.put("status", status.value());
        body.put("error", status.getReasonPhrase());
        body.put("message", message);
        body.put("path", path);
        return ResponseEntity.status(status).body(body);
    }
}
