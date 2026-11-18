# SocialFlow — Implementation Plan (PLAN): Pure Java Microservices Back End

**Scope:** Project 1 — Pure Java Microservices Back End (`Back End 13 - Java` Syllabus Alignment, zero Frontend/UI).

---

## Phase 1 — Frontend/UI Removal & Repo Cleanup
- [x] **1.1** Create `backup-with-frontend` Git tag preserving full-stack UI history before removal.
- [x] **1.2** Delete `frontend/` directory and `start_frontend.ps1` script cleanly from repository.
- [x] **1.3** Remove `frontend` service/build blocks from `docker-compose.yml`, `render.yaml`, `.github/workflows/ci.yml`, `start_docker.ps1`, and `comprehensive_test.ps1`.

## Phase 2 — Course Spec Hardening (Backend & Gateway)
- [x] **2.1** Add `GatewayExceptionHandler` (`ErrorWebExceptionHandler`) in `api-gateway` for centralized JSON error responses.
- [x] **2.2** Propagate JWT `role` (`USER` / `ADMIN`) via `X-User-Role` across `api-gateway`, `user-service`, and `post-service`; enable `@EnableMethodSecurity` and `@PreAuthorize`.
- [x] **2.3** Enforce authenticated write/bookmark rules in `post-service` `SecurityConfig` and add owner/admin S3 object deletion (`DELETE /api/v1/media`) in `media-service`.
- [x] **2.4** Auto-provision `users.role VARCHAR(50) NOT NULL DEFAULT 'USER'` on startup and support email or username login in `user-service`.

## Phase 3 — Documentation, Postman & Verification
- [x] **3.1** Synchronize `.agents/PRD.md`, `.agents/SPEC.md`, `.agents/PLAN.md`, `README.md`, and `postman/SocialFlow.postman_collection.json` strictly with the pure Java Microservices Back End spec.
- [x] **3.2** Run `mvn test` across all 6 Java modules, `pytest` on `ai-service`, `docker compose config -q`, and `render.yaml` YAML validation.
