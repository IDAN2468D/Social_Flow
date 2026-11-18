# SocialFlow — Implementation Plan (PLAN)

**Methodology:** Spec-First (`PRD.md` → `SPEC.md` → `PLAN.md` → Implementation → Verification)  
**Scope:** Dark Liquid Glass 4.0 Pro UI (`frontend/`) + `Back End 13 - Java` Microservices Alignment (`user-service`, `post-service`, `feed-service`, `media-service`, `notification-service`, `ai-service`, `api-gateway :8088`)

---

## Phase 1 — Spec-First Documentation & Design System Foundation
- [x] **1.1** Audit `frontend/` (`Next.js 15`, `React 19`, `Tailwind CSS v4`, `Zustand`, `Zod`) and `Back End 13 - Java` microservices (`user-service`, `post-service`, `feed-service`, `media-service`, `notification-service`, `ai-service`, `api-gateway`).
- [x] **1.2** Author and synchronize `.agents/PRD.md`, `.agents/SPEC.md`, and `.agents/PLAN.md` combining Dark Liquid Glass 4.0 Pro UI with the full microservices architecture.
- [x] **1.3** Configure `frontend/app/layout.tsx` (`Inter`, `Heebo`, `Plus Jakarta Sans`, `JetBrains Mono`) and `frontend/app/globals.css` (`#090A0F` Obsidian Void, `backdrop-blur-2xl`, specular borders, ambient aurora orbs, `.glass-bento`, `.glass-dock`, GPU animations).

## Phase 2 — API Gateway Routing, State Layer & Back End 13 Alignment
- [x] **2.1** Configure `api-gateway` (`:8088`) routing and `JwtAuthFilter` public read/health routes (`/api/v1/users/**`, `/api/v1/posts/**`, `/api/v1/stories/**`, `/api/v1/media/**`, `/api/media/**`, `/api/v1/ai/health`, `/api/v1/search`, `/api/v1/feed/trending`).
- [x] **2.2** Align `user-service` with `Back End 13 - Java`: `JWT` `role` claim (`USER` default), `S3` `profileImageUrl` update (`PUT /api/v1/users/profile`), follow/unfollow by ID or username, and user search (`GET /api/v1/users/search`).
- [x] **2.3** Align `media-service` (`POST /api/media/presign` & `/api/v1/media/upload-url` for MinIO S3) and add `hibernate.temp.use_jdbc_metadata_defaults: false` across `user-service`, `post-service`, `feed-service`, and `notification-service` for fast Render PostgreSQL startup.
- [x] **2.4** Implement `frontend/store/useSocialStore.ts` (4 feed tabs, optimistic likes/reposts/bookmarks/follows, WebSocket notifications, live `direction: 'rtl' | 'ltr'` toggle) and `frontend/lib/actions/social.actions.ts` with resilient Demo Mode fallback.

## Phase 3 — 3-Column Asymmetric Bento Shell & Navigation
- [x] **3.1** Build `frontend/components/layout/AppShell.tsx` (3-column desktop grid `260px | minmax(0,640px) | 340px`, ambient glow orbs, mobile sticky glass header & floating bottom dock).
- [x] **3.2** Build `frontend/components/layout/LeftNavRail.tsx` (navigation links, WebSocket unread badge, live `RTL / LTR` toggle pill, user mini-profile, gradient **New Post** CTA).
- [x] **3.3** Build `frontend/components/layout/RightBentoSidebar.tsx` (`Ctrl+K` Search & AI RAG card, Trending Hashtags, Who to Follow, and 4-row System Telemetry: `Gateway & Kafka Bus`, `Feed & Elasticsearch 8`, `MinIO S3 & Media`, `AI & LangGraph`).
- [x] **3.4** Build `frontend/components/feed/FeedHeaderTabs.tsx` (`For You`, `Following`, `Trending`, `Media`).

## Phase 4 — Composer, Threads, Bookmarks & MinIO S3 Media
- [x] **4.1** Build `frontend/components/composer/PostComposerCard.tsx` (`dir="auto"`, MinIO S3 presigned drag-and-drop upload + progress bar, interactive poll builder, SVG character ring, AI draft/enhance).
- [x] **4.2** Build `frontend/components/feed/PostCard.tsx` and `frontend/components/feed/SocialFlowHome.tsx` (connected thread lines, 6-reaction micro-bar, quote repost modal, Bento multi-image grid + lightbox, interactive poll bars).
- [x] **4.3** Build `frontend/app/bookmarks/page.tsx` for saved posts in Obsidian Liquid Glass styling.

## Phase 5 — Elasticsearch `Ctrl+K` Search, Bento Profile & Auth Views
- [x] **5.1** Build `frontend/components/search/CommandSearchModal.tsx` (`Ctrl+K` / `Cmd+K` debounced Elasticsearch search across posts, users, and hashtags with `highlightMatch` term highlighting, keyboard navigation, and AI RAG Feed Q&A trigger).
- [x] **5.2** Build `frontend/components/profile/BentoProfileHeader.tsx`, `frontend/components/profile/ProfileView.tsx`, and `/profile` + `/profile/[username]` routes with 4-tile Bento stats and S3 profile image support.
- [x] **5.3** Connect `/stories`, `/(social)/community`, `/login`, and `/register` routes to the Obsidian Liquid Glass design system.

## Phase 6 — Full-Stack Verification & QA Sign-Off
- [ ] **6.1** Run full Java test suite (`mvn test`), AI service Python tests (`pytest ai-service/tests/test_agent.py`), and frontend typecheck + production build (`npx tsc --noEmit` & `npm run build`).
- [ ] **6.2** Verify zero regressions across all microservices and routes, and complete QA sign-off (`@qa-verifier`).
