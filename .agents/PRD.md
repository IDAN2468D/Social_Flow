# SocialFlow — Product Requirements Document (PRD): Pure Java Microservices Back End

**Version:** 4.0 (Back End 13 - Java Syllabus Alignment: Pages 10–11 & 22)  
**Owner:** Idan Kazam (`IDAN2468D`)  
**Scope:** Project 1 — Distributed Event-Driven Social Network (`100% Pure Back End Microservices`, zero Frontend/UI)  
**Stack:** Java 17 · Spring Boot 3.3.4 · Spring Cloud API Gateway (`:8088`) · Apache Kafka (KRaft) · Elasticsearch 8.13 · MinIO S3 · PostgreSQL 16 · WebSocket STOMP · FastAPI AI (`:8086`) · Postman · JUnit 5 & Mockito · Docker & Kubernetes

---

## 1. Executive Vision
Build a production-grade, decoupled **Java Microservices Back End** for **SocialFlow** matching **Yaniv Arad's Back End AI Course** (Booklet Pages 10–11 & Page 22, *Project 1: רשת חברתית מבוססת Java Microservices*). All client interactions occur cleanly through REST APIs behind **Spring Cloud API Gateway (`:8088`)**, asynchronous **Apache Kafka** event streams, **Elasticsearch 8** indexing/search, **MinIO S3** presigned object storage, **PostgreSQL** (`Database-per-Service`), and **WebSocket STOMP**, tested and documented via **Postman**, **JUnit 5 + Mockito**, `comprehensive_test.ps1`, and **GitHub Actions CI/CD**.

---

## 2. Course Syllabus Alignment Matrix (Pages 10–11 & 22)

| Domain | Course Requirement | Implemented Architecture |
| :--- | :--- | :--- |
| **REST API & CRUD** | JSON/HTTP REST APIs, MVC layering, Centralized Error Manager (`@RestControllerAdvice` / `ErrorWebExceptionHandler`), Postman documentation | `user-service`, `post-service`, `feed-service`, `media-service`, `notification-service`, `api-gateway`, `postman/SocialFlow.postman_collection.json` |
| **Microservices Architecture** | Independent decoupled services, Database-per-Service, S3 service isolation for images, inter-service communication | 5 Spring Boot 3 microservices + `api-gateway` + `ai-service`, PostgreSQL schemas, `media-service` isolating S3/MinIO |
| **Gateway & Async** | Central API Gateway (`:8088`), Netty reactive/async routing, Docker inter-service networking | `api-gateway` (`Spring Cloud Gateway`), `docker-compose.yml`, `render.yaml` |
| **Kafka & Elasticsearch** | Event-driven Producers/Consumers with distinct `groupId`s, real-time indexing & search/filtering in Elasticsearch 8 | `post-events` & `user-events` topics, `FeedKafkaConsumer`, `NotificationKafkaConsumer`, `PostElasticsearchRepository`, `SearchController` |
| **Server-Side Security** | JWT authentication & authorization, `HttpOnly Cookies`, `Bearer` header, Role-based access (`USER` / `ADMIN`), Gateway protection | `JwtAuthFilter` (Gateway), `JwtAuthenticationFilter` + `@EnableMethodSecurity` + `@PreAuthorize` (`user-service`, `post-service`, `notification-service`) |
| **Testing & Automation** | JUnit 5, Spring Testing, Mockito unit/integration suites + GitHub Actions CI/CD | Test suites in all 6 Java modules (`mvn test`), `ai-service` pytest, `.github/workflows/ci.yml` |
| **Deployment & Ops** | Docker containers, Kubernetes orchestration (`k8s/`), monitoring & health probes (`/actuator/health`) | `docker-compose.yml`, `k8s/*.yaml`, `render.yaml`, Spring Boot Actuator across all Java services |

---

## 3. Core Functional Requirements
1. **Authentication, Roles & User Management (`user-service :8081`):**
   - Registration (`POST /api/auth/register`) and login by username or email (`POST /api/auth/login`), returning JWT (`role`, `userId`, `email`, `sub`) both in JSON body and `HttpOnly; SameSite=Lax` cookie.
   - Profile retrieval (`GET /api/v1/users/profile/{username}`), profile update with ownership or `ADMIN` check (`PUT /api/v1/users/profile`), `ADMIN` role management (`PUT /api/v1/users/{target}/role`), user search, and `Follow / Unfollow` emitting `user-events` to Kafka.
2. **Posts, Polls, Reactions, Stories & Lifecycle (`post-service :8082`):**
   - Full CRUD (`POST`, `GET`, `DELETE` restricted to owner or `ADMIN`), polls & voting, 6 reaction types, nested comments, reposts, bookmarks, and 24h stories.
   - Publishes `POST_CREATED`, `POST_LIKED`, `COMMENT_CREATED`, `POST_REPOSTED`, `POST_PINNED`, and `POST_DELETED` JSON events to `post-events`.
3. **Personalized Feeds & Real-Time Search (`feed-service :8083`):**
   - Consumes `post-events` & `user-events` (`groupId: feed-service-group`) to maintain PostgreSQL follow relations and real-time `Elasticsearch 8` `PostDocument` index (including deletion on `POST_DELETED`).
   - Serves `For You`, `Following`, `Trending`, `Trending Tags`, and `/api/v1/search` (`?q=`, `/multi`, `/tag/{tag}`).
4. **Object Storage Isolation (`media-service :8084`):**
   - Sole owner of `MinIO / AWS S3` credentials & presigned upload URLs (`POST /api/v1/media/upload-url`), plus owner/admin-guarded object deletion (`DELETE /api/v1/media?key=...`).
5. **Real-Time Alerts & Notifications (`notification-service :8085`):**
   - Consumes `post-events` & `user-events` (`groupId: notification-service-group`), persists alerts in PostgreSQL, exposes REST endpoints (`/api/v1/notifications/**`), and pushes over `WebSocket STOMP` (`/ws/**`).
