# SocialFlow — Technical & Design Specification (SPEC)

**Version:** 4.0 Pro (Dark Liquid Glass UI + Back End 13 Java Microservices)  
**Target Workspace:** `frontend/` (`Next.js 15`, `React 19`, `TypeScript`, `Tailwind CSS v4`, `Framer Motion`, `Lucide React`, `Zustand`, `Zod`) & Backend Microservices (`Spring Boot 3`, `API Gateway :8088`, `FastAPI AI :8086`)

---

## 1. System & Microservices Architecture (`Back End 13 - Java`)

All frontend traffic routes through **Spring Cloud API Gateway** (`:8088`) via Next.js `/api/:path*` proxy rewrites (`frontend/next.config.mjs` & `frontend/app/api/[...path]/route.ts`).

| Microservice | Gateway Routes (`:8088`) | Core Responsibilities | Protocol & Persistence |
| :--- | :--- | :--- | :--- |
| **`user-service`** | `/api/auth/**`, `/api/users/**`, `/api/v1/users/**` | Registration, login, `JWT` issuance with `role` claim (`USER` default), `S3` `profileImageUrl` & profile update (`PUT /profile`), user search (`GET /search?q=`), follow/unfollow by ID or username | `REST JSON` · `PostgreSQL` (`temp.use_jdbc_metadata_defaults: false`) · `JWT` |
| **`post-service`** | `/api/posts/**`, `/api/v1/posts/**`, `/api/stories/**`, `/api/v1/stories/**` | Post creation, polls, stories, nested comments, likes/reposts/bookmarks, and publishing `PostCreatedEvent` to `Apache Kafka` | `REST JSON` · `PostgreSQL` · `Apache Kafka` |
| **`feed-service`** | `/api/feed/**`, `/api/v1/feed/**`, `/api/search/**`, `/api/v1/search/**` | Personalized & trending feeds (`For You`, `Following`, `Trending`, `Media`) consumed from `Kafka` and instant full-text search via `Elasticsearch 8` | `REST JSON` · `PostgreSQL` · `Kafka` · `Elasticsearch 8` |
| **`media-service`** | `/api/media/**`, `/api/v1/media/**` | Issuing `MinIO S3` presigned upload/download URLs (`POST /api/media/presign` & `POST /api/v1/media/upload-url`) for posts and profile avatars | `REST JSON` · `MinIO S3` (`HTTP PUT` direct upload) |
| **`notification-service`** | `/ws/**`, `/api/notifications/**`, `/api/v1/notifications/**` | Real-time push notifications (likes, replies, follows, mentions) over `WebSocket STOMP` | `WebSocket STOMP` · `PostgreSQL` · `Kafka` |
| **`ai-service`** | `/api/v1/ai/**` (`:8086`) | `LangGraph` & `Gemini` autonomous feed RAG Q&A (`/api/v1/ai/ask-feed`), post analysis/enhancement (`/api/v1/ai/analyze`), and health (`/api/v1/ai/health`) | `REST JSON` (`FastAPI`) · `LangGraph` · `Gemini` |
| **`api-gateway`** | `:8088` (`/actuator/health`) | Central routing, `JwtAuthFilter` validation (`HttpOnly Cookie` & `Authorization: Bearer`), CORS, and public read/health route allowlisting | `Spring Cloud Gateway` |

---

## 2. Dark Liquid Glass 4.0 Pro Design Tokens

### 2.1 Color Palette & Glass Physics (`frontend/app/globals.css`)

| Token | CSS Variable | Value / Utility | Usage |
| :--- | :--- | :--- | :--- |
| **Obsidian Void** | `--bg-primary` / `--bg-obsidian-void` | `#090A0F` | Global viewport canvas |
| **Deep Space** | `--bg-deep-space` | `#10121A` | Secondary recessed surfaces |
| **Liquid Glass Bento** | `--bg-bento` | `rgba(18, 21, 33, 0.72)` + `backdrop-blur-xl` / `2xl` | Bento cards, rails, modals |
| **Glass Surface Hover** | `--bg-bento-hover` | `rgba(24, 28, 44, 0.84)` | Interactive tile hover state |
| **Specular Hairline Border** | `--border-glass` | `1px solid rgba(255, 255, 255, 0.08)` | Default card/rail border |
| **Neon Focus / Hover Border** | `--border-glass-hover` | `rgba(99, 102, 241, 0.40)` | Active/focused Bento border |
| **Electric Indigo** | `--accent-indigo` | `#6366F1` | Primary brand CTA, active nav, search highlights |
| **Cyber Violet** | `--accent-violet` | `#8B5CF6` | Gradient stops, AI/LangGraph accents |
| **Cyber Cyan** | `--accent-cyber-cyan` | `#06B6D4` | Liquid gradient highlights & telemetry |
| **Emerald Live Pulse** | `--accent-emerald` | `#10B981` | Kafka / WebSocket / Gateway healthy pulse |
| **Rose Like Accent** | `--accent-rose` | `#F43F5E` | Like reaction active state & heart burst |
| **Text Primary / Secondary / Muted** | `--text-primary` / `--text-secondary` / `--text-muted` | `#F8FAFC` / `#94A3B8` / `#64748B` | Typography hierarchy (`>= 4.5:1` contrast) |

### 2.2 Typography & Live Bilingual `RTL` / `LTR`
- **Sans Font Stack:** `'Inter', 'Heebo', 'Plus Jakarta Sans', system-ui, sans-serif`
- **Monospace Stack:** `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace` (metrics, shortcuts `Ctrl+K`, telemetry, code blocks)
- **Live Directionality (`useSocialStore.ts` + `LeftNavRail.tsx`):**
  - `direction: 'rtl' | 'ltr'` (defaults to `'rtl'`, `lang="he"`) with `toggleDirection()` updating `document.documentElement.dir` live.
  - All post copy, comments, and composer inputs use `dir="auto"` (`unicode-bidi: plaintext`) for natural Hebrew + English BiDi rendering.

---

## 3. Responsive 3-Column Bento Grid & Modular Components (`frontend/`)

- **Desktop (`max-w-7xl mx-auto`):** `260px` Sticky Left Rail \| `minmax(0, 640px)` Center Stream \| `340px` Sticky Right Bento Sidebar.
- **Tablet (`md`–`lg`):** Compact rail + main stream; **Mobile (`< md`):** Sticky top glass header + floating bottom glass dock (`.glass-dock`).

| Module Path | Responsibility |
| :--- | :--- |
| `app/layout.tsx` & `app/globals.css` | Fonts (`Inter`, `Heebo`, `Plus Jakarta Sans`, `JetBrains Mono`), Obsidian Liquid Glass CSS tokens, ambient aurora orbs, `.glass-bento`, `.glass-dock`, GPU animations |
| `store/useSocialStore.ts` | Zustand store: feed tabs, posts, optimistic likes/reposts/bookmarks/follows, `direction` (`rtl` \| `ltr`), WebSocket notifications, auth state |
| `lib/validations/social.schema.ts` | Zod schemas for user profiles (with `role` & `profileImageUrl`), posts, polls, and presigned upload payloads |
| `lib/actions/social.actions.ts` | Gateway API actions (`credentials: 'include'` + `Bearer` token) with graceful Demo Mode fallback |
| `components/layout/AppShell.tsx` | 3-column asymmetric grid, ambient orbs, mobile top bar & floating bottom glass dock |
| `components/layout/LeftNavRail.tsx` | Navigation links (`Feed`, `Explore`, `Stories`, `Notifications`, `Bookmarks`, `Profile`), unread badge, live `RTL/LTR` toggle pill, mini-profile, **New Post** CTA |
| `components/layout/RightBentoSidebar.tsx` | `Ctrl+K` Search & AI RAG card, Trending Hashtags, Who to Follow, and 4-row System Telemetry (`Gateway & Kafka`, `Feed & Elasticsearch 8`, `MinIO S3 & Media`, `AI & LangGraph`) |
| `components/feed/FeedHeaderTabs.tsx` | Sticky `backdrop-blur-xl` custom feed tabs (`For You`, `Following`, `Trending`, `Media`) |
| `components/composer/PostComposerCard.tsx` | `dir="auto"` composer, MinIO S3 presigned upload + progress bar, interactive poll builder, SVG character ring, AI enhance |
| `components/feed/PostCard.tsx` | Connected thread lines, 6-reaction micro-bar, quote repost modal, Bento multi-image grid + lightbox, interactive poll bars |
| `components/search/CommandSearchModal.tsx` | `Ctrl+K` / `Cmd+K` Elasticsearch instant search with `highlightMatch` term highlighting, keyboard nav, and AI RAG Q&A |
| `components/profile/BentoProfileHeader.tsx` & `ProfileView.tsx` | Hero cover, glass avatar card (S3 profile image), 4-tile Bento stats, edit profile modal, tabbed `Posts` / `Media` / `Likes` / `Replies` |
| `app/bookmarks/page.tsx`, `app/stories/page.tsx`, `app/(social)/community/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx` | Dedicated App Router pages integrated with `AppShell` and Obsidian Liquid Glass styling |

---

## 4. Core Integration Flows

### 4.1 MinIO S3 Presigned Media & Profile Image Flow
1. Client requests presigned URL via `POST /api/media/presign` or `POST /api/v1/media/upload-url` (`media-service` through `api-gateway :8088`).
2. `media-service` returns `{ uploadUrl, publicUrl, objectKey }`.
3. Browser uploads file directly to `MinIO S3` via `HTTP PUT` to `uploadUrl` with live progress tracking.
4. For posts: `mediaUrl` is submitted to `POST /api/v1/posts` (`post-service` → `Kafka` → `feed-service` & `Elasticsearch 8`).
5. For profile avatars: `profileImageUrl` is persisted via `PUT /api/v1/users/profile` (`user-service` → `PostgreSQL`).

### 4.2 JWT + Roles Security Flow
1. `user-service` authenticates credentials and issues a `JWT` containing `role` (`USER` by default, null-safe for legacy rows) via `HttpOnly Cookie` and response payload.
2. `api-gateway` (`JwtAuthFilter`) validates JWTs on protected mutations while allowing configured public GET/health routes (`/api/v1/ai/health`, `/api/v1/stories`, `/api/v1/search`, `/api/v1/feed/trending`, etc.).
