# SocialFlow — Technical Specification (SPEC): Pure Java Microservices Back End

**Version:** 4.0 (Back End 13 - Java Syllabus Compliance)  
**Scope:** Strictly Back End Microservices, Infrastructure, Testing, Postman & Cloud/K8s Deployment (no Frontend/UI).

---

## 1. Microservices & Gateway Architecture

All external API traffic enters through **Spring Cloud API Gateway (`:8088`)**.

| Service | Gateway Routes (`:8088`) | Direct Port | Core Components & Persistence |
| :--- | :--- | :---: | :--- |
| **`api-gateway`** | `/*` | `8088` | `JwtAuthFilter` (`GlobalFilter`), `GatewayExceptionHandler` (`ErrorWebExceptionHandler`), CORS config, forwards `X-User-Id`, `X-Auth-Username`, `X-User-Email`, `X-User-Role` |
| **`user-service`** | `/api/auth/**`, `/api/v1/users/**`, `/api/users/**` | `8081` | `AuthController`, `UserController`, `SecurityConfig` (`@EnableMethodSecurity`), `JwtService`, `UserEventProducer`, `GlobalExceptionHandler`, `PostgreSQL` (`users`, `followers`) |
| **`post-service`** | `/api/v1/posts/**`, `/api/posts/**`, `/api/v1/stories/**`, `/api/stories/**` | `8082` | `PostController`, `StoryController`, `SecurityConfig` (`@EnableMethodSecurity`), `PostKafkaProducer`, `GlobalExceptionHandler`, `PostgreSQL` |
| **`feed-service`** | `/api/v1/feed/**`, `/api/feed/**`, `/api/v1/search/**`, `/api/search/**` | `8083` | `FeedController`, `SearchController`, `FeedKafkaConsumer`, `PostElasticsearchRepository`, `GlobalExceptionHandler`, `PostgreSQL` + `Elasticsearch 8.13` |
| **`media-service`** | `/api/v1/media/**`, `/api/media/**` | `8084` | `MediaController` (`POST /upload-url`, `POST /presign`, `DELETE /`), `MediaService` (AWS S3 SDK v2 + MinIO), `GlobalExceptionHandler` |
| **`notification-service`** | `/api/v1/notifications/**`, `/ws/**` | `8085` | `NotificationController`, `NotificationKafkaConsumer`, `WebSocketConfig` (STOMP), `GlobalExceptionHandler`, `PostgreSQL` |
| **`ai-service`** | `/api/v1/ai/**` | `8086` | Python FastAPI (`analyze`, `ask-feed` RAG, `chat-reply`, `/health`) |

---

## 2. Security, JWT, HttpOnly Cookies & Role Enforcement
1. **Authentication Flow (`user-service`):**
   - `AuthService.login()` supports lookup by `username` or `email` (`BCryptPasswordEncoder`).
   - `JwtService` embeds `userId`, `email`, `role` (`USER` default, `ADMIN` supported), and `sub` (`username`).
   - `AuthController` returns `AuthResponse` JSON and sets `Set-Cookie: jwt=<token>; HttpOnly; SameSite=Lax; Path=/`.
   - `UserApplication` ensures `users.role VARCHAR(50) NOT NULL DEFAULT 'USER'` on startup for legacy DB compatibility.
2. **Gateway Enforcement (`api-gateway`):**
   - `JwtAuthFilter` validates `Authorization: Bearer <token>` or `HttpOnly` cookie (`jwt`, `token`, `access_token`, `AUTH-TOKEN`).
   - Allows anonymous access only to `/api/auth/**`, `/actuator/**`, Swagger/OpenAPI docs, `/ws/**`, `/api/v1/ai/health`, and configured public read endpoints (`GET /api/v1/search/**`, `GET /api/v1/feed/trending*`, `GET /api/v1/feed/for-you`, `GET /api/v1/stories/**`, `GET /api/v1/users/profile/**`, `GET /api/v1/users/search`).
   - Returns structured `401 Unauthorized` JSON before routing protected calls when token is missing or invalid.
   - Forwards normalized `X-User-Role` (`USER` / `ADMIN`), `X-User-Id`, `X-Auth-Username`, and `X-User-Email`.
3. **Method-Level & Ownership Security (`user-service`, `post-service`, `media-service`):**
   - `user-service` & `post-service` parse `X-User-Role` / JWT `role` claim into `ROLE_USER` / `ROLE_ADMIN`.
   - `@EnableMethodSecurity` + `@PreAuthorize` protect write/admin operations (`PUT /api/v1/users/{target}/role` requires `ROLE_ADMIN`; profile edits & post/media deletions allow owner or `ADMIN`).

---

## 3. Centralized Error Handling
Every microservice implements `@RestControllerAdvice` (`GlobalExceptionHandler`) and `api-gateway` implements `ErrorWebExceptionHandler` (`GatewayExceptionHandler`), emitting uniform JSON:
```json
{
  "timestamp": "...",
  "status": 400,
  "error": "Bad Request",
  "message": "...",
  "path": "/api/..."
}
```

---

## 4. Event-Driven Kafka & Elasticsearch 8 Flow
- **Kafka Broker:** Confluent Kafka 7.6.0 (KRaft mode, `9095` host / `9092` internal, monitored via `Kafka UI :8080`).
- **Topics:**
  - `post-events` (produced by `PostKafkaProducer`): `POST_CREATED`, `POST_LIKED`, `COMMENT_CREATED`, `POST_REPOSTED`, `POST_PINNED`, `POST_DELETED`.
  - `user-events` (produced by `UserEventProducer`): `UserRegisteredEvent`, `UserFollowedEvent`.
- **Distinct Consumer Groups:** `feed-service-group` (indexes/updates/deletes `PostDocument` in Elasticsearch 8 + updates `FollowerRelation`) and `notification-service-group` (persists notifications + pushes over WebSocket STOMP).

---

## 5. Testing, CI/CD & Orchestration
- **Java Tests (`mvn test`):** JUnit 5 + Mockito unit/filter tests in all 6 Java modules (`user-service`, `api-gateway`, `post-service`, `feed-service`, `media-service`, `notification-service`).
- **Python AI Tests:** `pytest ai-service/tests/test_agent.py`.
- **Postman Collection:** `postman/SocialFlow.postman_collection.json` covering all Gateway REST routes and Actuator checks.
- **Orchestration & Cloud:** `docker-compose.yml` (local stack), `k8s/*.yaml` (Kubernetes manifests), `render.yaml` (Render Blueprint), and `.github/workflows/ci.yml` (GitHub Actions).
