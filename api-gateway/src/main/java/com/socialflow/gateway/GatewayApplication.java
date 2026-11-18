package com.socialflow.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.List;

@SpringBootApplication
public class GatewayApplication {

    private static final List<String> SERVICE_PREFIXES = List.of(
            "USER_SERVICE",
            "POST_SERVICE",
            "FEED_SERVICE",
            "MEDIA_SERVICE",
            "NOTIFICATION_SERVICE",
            "AI_SERVICE"
    );

    public static void main(String[] args) {
        resolveRenderServiceUris();
        SpringApplication.run(GatewayApplication.class, args);
    }

    static void resolveRenderServiceUris() {
        boolean onRender = "true".equalsIgnoreCase(System.getenv("RENDER"))
                || System.getenv("RENDER_SERVICE_ID") != null;

        for (String prefix : SERVICE_PREFIXES) {
            String uriKey = prefix + "_URI";
            String hostKey = prefix + "_HOST";
            String existingUri = System.getenv(uriKey);
            String host = System.getenv(hostKey);
            if ((existingUri == null || existingUri.isBlank()) && System.getProperty(uriKey) == null) {
                String resolvedHost = null;
                if (host != null && !host.isBlank()) {
                    resolvedHost = host.trim().replaceFirst("^https?://", "").replaceAll("/+$", "");
                } else if (onRender) {
                    resolvedHost = "socialflow-" + prefix.toLowerCase().replace('_', '-') + ".onrender.com";
                }

                if (resolvedHost != null) {
                    System.setProperty(uriKey, "https://" + resolvedHost);
                    if ("NOTIFICATION_SERVICE".equals(prefix)
                            && System.getenv("NOTIFICATION_SERVICE_WS_URI") == null
                            && System.getProperty("NOTIFICATION_SERVICE_WS_URI") == null) {
                        System.setProperty("NOTIFICATION_SERVICE_WS_URI", "wss://" + resolvedHost);
                    }
                }
            }
        }
    }
}