# SocialFlow — Product Requirements Document (PRD): Dark Liquid Glass 4.0 Pro

**Version:** 4.0 Pro (2026 UI/UX & Back End 13 Microservices Alignment)  
**Owner:** Team Lead Idan Kazam (`IDAN2468D`)  
**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Zustand · Spring Boot 3 Microservices (`Back End 13 - Java`) · Spring Cloud API Gateway (`:8088`) · Apache Kafka · Elasticsearch 8 · MinIO S3 · WebSocket STOMP · FastAPI AI/LangGraph & Gemini (`:8086`) · PostgreSQL

---

## 1. Executive Vision
Transform **SocialFlow** into a flagship 2026 AI-era distributed social network built atop an event-driven **Java Microservices** architecture (`Spring Boot 3`, `API Gateway :8088`, `Apache Kafka`, `Elasticsearch 8`, `MinIO S3`, `PostgreSQL`, and `FastAPI LangGraph + Gemini`). The **Dark Liquid Glass 4.0 Pro** UI unifies:
- **Threads Web conversational clarity:** Sticky navigation rail, connected thread reply lines, interactive polls, quote reposts, and single-focus stream readability.
- **Bluesky custom feed discovery:** Pinned feed switcher tabs (`For You`, `Following`, `Trending`, `Media`), instant hashtag filtering, and community discovery.
- **Dribbble Dark Liquid Glass & Asymmetric Bento Grids:** `Obsidian Void` (`#090A0F`) canvas, translucent `rgba(18, 21, 33, 0.72)` Bento tiles with `backdrop-blur-2xl`, `1px solid rgba(255, 255, 255, 0.08)` specular hairline borders, ambient radial aurora glows, and 120Hz GPU-accelerated spring micro-interactions.

---

## 2. Core Goals & Success Metrics (KPIs)

| Goal ID | Domain | Target Requirement | Architecture / Reference |
| :--- | :--- | :--- | :--- |
| **G-01** | Visual Language | Full **Dark Liquid Glass 4.0 Pro** with `Obsidian Void` (`#090A0F`), `backdrop-blur-2xl`, and specular hairline borders (`1px solid rgba(255,255,255,0.08)`) | Dribbble Glassmorphism & Wavespace 2026 UI |
| **G-02** | Spatial Layout | Responsive **3-Column Asymmetric Bento Grid** (`260px \| minmax(0,640px) \| 340px`) with live `RTL` / `LTR` directionality toggle | Dribbble Bento Data & Pixso Glass & Bento |
| **G-03** | Multi-Feed Discovery | Instant (`< 100ms` Optimistic UI) switching across `For You`, `Following`, `Trending`, and `Media` tabs | `feed-service` + `Kafka` + `Elasticsearch 8` |
| **G-04** | Real-Time Search & AI | Floating `Ctrl+K` / `Cmd+K` command palette with debounced search (`< 150ms`), term highlighting, and AI RAG Feed Q&A | `feed-service` (`Elasticsearch 8`) + `ai-service` (`LangGraph` & `Gemini`) |
| **G-05** | Smart Media Upload | Drag-and-drop composer with progress bar and direct browser-to-S3 upload via `Presigned URLs` | `media-service` (`MinIO S3`) via `API Gateway :8088` |
| **G-06** | Security & Roles | `JWT + HttpOnly Cookies` + `Bearer` token auth with user roles (`USER` / `ADMIN`), S3 profile images, and WCAG AA contrast (`>= 4.5:1`) | `user-service` (`JWT` + `Roles` + `S3 Profile Image`) |

---

## 3. Target User Experience & Functional Requirements

### 3.1 3-Column Asymmetric Bento Shell (`AppShell`, `LeftNavRail`, `RightBentoSidebar`)
- **Left Sticky Glass Navigation Rail (`260px`):** Brand logo with ambient glow, primary links (`Feed`, `Explore / Community`, `Stories`, `Notifications` with live WebSocket STOMP unread badge, `Bookmarks`, `Profile`, `AI Agent`), live **`RTL / LTR` directionality toggle pill**, user mini-profile pill (showing role & JWT status), and gradient **New Post** CTA.
- **Center Single-Column Stream (`minmax(0, 640px)`):** Sticky `backdrop-blur-xl` **Pinned Feed Switcher** (`For You`, `Following`, `Trending`, `Media`), inline expandable `PostComposerCard`, `StoriesBar`, and high-readability post stream with shimmer glass skeletons.
- **Right Bento Discovery & System Telemetry Column (`340px`):**
  1. **Command Search Trigger (`Ctrl+K` / `Cmd+K`)** & AI RAG Feed Q&A entry point.
  2. **Trending Hashtags & Communities** with live tag filtering.
  3. **Who to Follow** (optimistic follow/unfollow by username or ID against `user-service`) + **Live System Telemetry Bento** monitoring `Gateway & Kafka Bus`, `Feed & Elasticsearch 8`, `MinIO S3 & Media`, and `AI & LangGraph`.
- **Responsive Breakpoints:**
  - **Desktop (`>= 1280px`):** Full 3-column asymmetric Bento grid.
  - **Tablet (`768px–1279px`):** Compact rail + main stream with collapsible Bento widgets.
  - **Mobile (`< 768px`):** Sticky top glass header + floating bottom glass dock (`backdrop-blur-2xl`).

### 3.2 Rich Media & Poll Composer (`PostComposerCard`)
- **Bilingual Auto-BiDi:** Automatic `dir="auto"` per-paragraph text direction (`RTL` Hebrew / `LTR` English & code), SVG radial character progress ring, `#hashtag` / `@mention` chips, and Markdown/code snippet support.
- **MinIO S3 Presigned Upload:** Drag-and-drop image/video requests a presigned URL from `media-service` (`/api/media/presign` or `/api/v1/media/upload-url`), uploads directly to `MinIO S3` via HTTP `PUT` with an animated progress bar, and attaches `mediaUrl` to `post-service`.
- **Interactive Poll Builder & AI Draft:** Toggleable poll options (2–4 choices + duration) and AI post enhancement via `ai-service` (`LangGraph` & `Gemini`).

### 3.3 Interactive Post Cards & Threads (`PostCard`)
- **Thread Connectors:** Vertical dynamic connector lines linking parent posts and nested replies.
- **Bento Media & Lightbox:** Rounded (`rounded-2xl`) multi-image Bento grid with full-screen glass lightbox.
- **6-Reaction Micro-Bar & Quote Repost:** Spring-animated reactions, optimistic `Like`, `Repost` / `Quote Repost`, `Bookmark` (persisted & viewable at `/bookmarks`), `Share`, and `Comment` drawers, plus live interactive poll voting bars.

### 3.4 Elasticsearch Command Palette (`CommandSearchModal`)
- Opens globally via `Ctrl+K` / `Cmd+K` or the sidebar search trigger.
- Debounced (`200ms`) query against `/api/v1/search` / `/api/search` (`feed-service` / `Elasticsearch 8`), grouping **Posts**, **People**, and **Hashtags** with highlighted matching terms, full keyboard navigation (`↑`, `↓`, `Enter`, `Esc`), and one-click handoff to **AI RAG Feed Q&A** (`ai-service`).

### 3.5 Bento Profile, Auth & Roles (`user-service`)
- **Authentication & Roles:** Split-screen Dark Liquid Glass `/login` and `/register` views backed by `user-service` (`JWT` with `role` claim, `HttpOnly Cookies`, and `Bearer` header).
- **Bento Profile (`/profile`, `/profile/[username]`):** Hero banner, overlapping glass avatar card (supporting S3 profile image upload via `media-service`), 4-tile Bento stats (`Posts`, `Followers`, `Following`, `Engagement Impact`), edit profile modal (`fullName`, `bio`, `profileImageUrl`), and tabbed content (`Posts`, `Media`, `Likes`, `Replies`).

---

## 4. Non-Functional & Architectural Constraints
1. **Back End 13 - Java Microservices Integrity:** Preserve all `Spring Boot 3` microservices (`user-service`, `post-service`, `feed-service`, `media-service`, `notification-service`, `api-gateway :8088`) and `ai-service` (`:8086`) contracts, including Render PostgreSQL fast-startup (`temp.use_jdbc_metadata_defaults: false`).
2. **Resilient Graceful Fallback:** `api-client` / Zustand store provides non-blocking Glass Toast notifications and rich Demo Mode fallback when Docker/cloud containers are offline.
3. **Accessibility & Performance:** WCAG AA contrast (`>= 4.5:1`), `aria-label` on icon controls, `prefers-reduced-motion` respect, GPU-only transforms (`translate3d`, `opacity`), and zero TypeScript/Next.js build regressions.
