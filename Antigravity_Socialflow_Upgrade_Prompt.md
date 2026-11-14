# Antigravity Master Prompt — Audit & Upgrade `SocialFlow` to 100% Course Spec

Copy and paste the prompt below directly into **Google Antigravity IDE** inside the `SocialFlow` repository (use **Gemini 4 Hydrogen** or **Gemini 4 Carbon** if running in Cloud/Remote Agents mode).

---

# Role & Context
You are a Senior Java & Distributed Systems Architect working under Team Lead **Idan Kazam** on the **SocialFlow** Java Microservices repository (`user-service`, `post-service`, `feed-service`, `media-service`, `api-gateway`, PostgreSQL, Apache Kafka, Elasticsearch 8, MinIO S3, React).
Your mission is to audit the existing codebase against the **Java Microservices Social Network** specification (Course Pages 10–11 & 22), fix or implement any missing pieces, verify all tests pass, and push directly to GitHub.

# Execution Rules
1. **ENVIRONMENT AWARENESS:** If running in Cloud/Linux, run shell commands directly. If running on local Windows, prefix commands with `cmd /c`.
2. **AUDIT FIRST, DO NOT BREAK WORKING CODE:** Inspect existing `pom.xml`, `application.yml`, controllers, security configs, and tests before editing. Preserve all working endpoints and Docker Compose setup.
3. **MODULAR & PRODUCTION-READY:** Keep changes clean, focused, and free of placeholders.

---

# Implementation Phases (Execute in Order)

## Phase 1: Audit Existing Repository
1. List all Maven modules, `pom.xml` files, `application*.yml`, `docker-compose.yml`, `.github/workflows/`, `k8s/`, and existing tests under `src/test/java`.
2. Identify which of the requirements below are already implemented vs. missing or incomplete, and only build/fix what is missing.

## Phase 2: Server-Side Security & Centralized Error Handling
1. **API Gateway (`api-gateway`):**
   - Ensure **JWT + HttpOnly Cookie** authentication is enforced centrally at the Gateway filter level, allowing public access only to `/api/auth/**`, `/actuator/health`, and Swagger/OpenAPI docs.
   - Forward authenticated user identity headers (e.g., `X-User-Id`, `X-User-Email`) to downstream microservices (`user-service`, `post-service`, `feed-service`, `media-service`).
   - Verify CORS and cookie security flags (`HttpOnly`, `SameSite=Lax`).
2. **Centralized Error Handling:**
   - Ensure each microservice has a `@RestControllerAdvice` global exception handler returning consistent JSON error responses (timestamp, status, error, message, path).

## Phase 3: Kafka, Elasticsearch & S3 (MinIO) Verification
1. Verify **Kafka** producers/consumers use explicit topic names, JSON serialization, and dead-letter/error logging.
2. Verify **Elasticsearch 8** indexing and search endpoints in `post-service` / `feed-service`.
3. Verify **MinIO (S3)** presigned URL / object upload flow in `media-service`.

## Phase 4: JUnit 5, Spring Testing & Mockito Coverage
1. Ensure every service (`api-gateway`, `user-service`, `post-service`, `feed-service`, `media-service`) has clean **JUnit 5 + Mockito + Spring Boot Test** (`@WebMvcTest` or unit tests with `@Mock` / `@InjectMocks`) covering:
   - Auth/JWT validation & cookie handling
   - Core CRUD / service business logic
   - Kafka event publishing / Elasticsearch / S3 service logic (mocked so tests run fast in CI without requiring live Docker containers).

## Phase 5: CI/CD, Kubernetes & Observability
1. **CI/CD (`.github/workflows/ci.yml`):**
   - Add or update a GitHub Actions workflow that sets up JDK 17/21, caches Maven dependencies, runs `mvn test` across all modules, and validates `docker compose config`.
2. **Kubernetes (`k8s/`):**
   - Add clean Kubernetes Deployment and Service manifests in `k8s/` for `api-gateway` (NodePort/LoadBalancer), `user-service`, `post-service`, `feed-service`, `media-service`, and core infra (`postgres`, `kafka`, `elasticsearch`, `minio`).
3. **Monitoring & Logging:**
   - Ensure `spring-boot-starter-actuator` is enabled with `/actuator/health` exposed across services for Docker/K8s readiness & liveness probes.

---

# Verification & Direct GitHub Push
Run the following checks sequentially and fix any failures before pushing:

1. Run Maven test suite across all modules:
   `mvn test`
2. Validate Docker Compose configuration (if `docker` is available):
   `docker compose config -q`
3. Check git status, commit, and push directly to GitHub:
   `git status`
   `git add .`
   `git commit -m "feat: align SocialFlow with gateway JWT cookies, JUnit/Mockito tests, CI/CD, K8s manifests, and actuator"`
   `git push`

Report back with a concise summary of what was already present, what was added/fixed, `mvn test` results per module, and the final GitHub commit hash.
