# SocialFlow — Product Requirements Document (PRD)

**Version:** 2.0 (2026 UI/UX Redesign)  
**Owner:** Team Lead Idan Kazam (`IDAN2468D`)  
**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · Zustand · Spring Boot 3 Microservices · API Gateway (`:8088`) · Apache Kafka · Elasticsearch 8 · MinIO S3 · WebSocket STOMP · FastAPI AI/LangGraph (`:8086`)

---

## 1. Product Vision
Transform **SocialFlow** into a flagship 2026 AI-era social network combining:
- The **conversational clarity and single-focus readability** of **Threads Web** (clean navigation rail, connected thread tree lines, interactive polls, spoiler/tag affordances, quick-access insights).
- The **multi-feed discovery architecture** of **Bluesky** (pinned feed switcher tabs: `For You`, `Following`, `Trending`, `Media`, starter/community discovery cards, instant keyword & tag filtering).
- The **visual polish** of **Dribbble Dark Liquid Glass & Bento Grids** (Obsidian `#090A0F` canvas, translucent `rgba(18, 21, 33, 0.72)` Bento tiles, `1px` `border-white/10` hairline borders, ambient radial glows, and 150–250ms spring micro-interactions).

---

## 2. Target User Experience & Core Requirements

### 2.1 3-Zone Asymmetric Shell
- **Left Sticky Glass Navigation Rail (`260px`):** Primary navigation links (`Home / Feed`, `Explore`, `Stories`, `Notifications` with live WebSocket unread badge, `Profile`, `AI Agent`), user mini-profile pill, and primary gradient **"New Post"** CTA button.
- **Center Single-Column Stream (`minmax(0, 640px)`):** Anchored by a sticky `backdrop-blur-xl` **Pinned Feed Switcher** (`For You`, `Following`, `Trending`, `Media`), inline expandable Quick Composer, Stories bar, and high-readability post stream.
- **Right Bento Discovery & Real-Time Activity Column (`340px`):** Modular Bento tiles featuring:
  1. **Elasticsearch Instant Search Trigger (`Ctrl+K` / `Cmd+K`)** & RAG Feed Q&A entry point.
  2. **Trending Hashtags & Communities** with live tag filtering.
  3. **Who to Follow + Live System Telemetry** badge (API Gateway / Kafka / WebSocket STOMP health pulse).
- **Responsive Collapse (Mobile & Tablet):** Cleanly collapses into a sticky top glass bar + floating bottom glass dock (`backdrop-blur-2xl`).

### 2.2 Rich Media & Poll Composer
- Drag-and-drop **MinIO S3 presigned image/video upload** with real-time upload progress bar and live multi-image preview grid.
- **Interactive Poll Builder** toggle (question + 2–4 options, duration selector).
- **Code / Markdown Snippet** support and `#hashtag` / `@mention` autocomplete.
- **Character Ring Indicator** and AI Post Enhancement / LangGraph Autonomous Draft trigger.

### 2.3 Interactive Post Cards
- Author header with verification badge, avatar ring, relative timestamp, and hover profile preview card.
- **Connected Thread Reply Lines** visualizing conversational context and nested comments.
- **Animated Reaction Bar** with spring micro-interactions (`Like`, `Repost`, `Bookmark`, `Share`, `Comment` counter).
- **Pinterest / Bento Multi-Image Grid** and image lightbox viewer, plus **Interactive Poll Bars** with live percentage fills.
- **Real-Time View & Engagement Badges** rendered in `JetBrains Mono`.

### 2.4 Elasticsearch Instant Command Palette (`Ctrl+K` / `Cmd+K`)
- Floating Obsidian Liquid Glass command modal (`backdrop-blur-2xl`).
- Instant debounced search across **posts**, **users**, and **hashtags** powered by Elasticsearch (`feed-service` via `/api/v1/search`).
- Keyboard navigation (`↑`, `↓`, `Enter`, `Esc`) and quick action to invoke the **AI RAG Feed Q&A** (`ai-service`).

### 2.5 Bento Profile Page
- Hero cover banner with overlapping glass avatar card and follow/edit profile actions.
- **4-Tile Bento Stats Grid:** `Posts`, `Followers`, `Following`, and `Engagement Impact`.
- **Tabbed Content Views:** `Posts`, `Media` (Masonry/Bento gallery), `Likes`, and `Replies`.

### 2.6 Bilingual & RTL/LTR Readiness
- Full support for **Hebrew (RTL)** and **English (LTR)** side by side.
- Automatic per-paragraph text direction (`dir="auto"`) across post content, comments, search queries, and composer inputs.
- Unified typography pairing `Inter`, `Heebo`, and `Plus Jakarta Sans` for seamless Hebrew + Latin glyph harmony.

---

## 3. Non-Negotiable Constraints
1. **Preserve Backend Contracts:** All existing API Gateway calls (`/api/auth/**`, `/api/users/**`, `/api/posts/**`, `/api/feed/**`, `/api/media/**`, `/api/v1/**`, and STOMP/WebSocket notifications) must remain 100% functional with graceful offline fallbacks.
2. **WCAG Contrast Compliance:** All text over Obsidian glass surfaces must maintain high readability (`#F8FAFC` primary, `#94A3B8` secondary).
3. **Zero Build Regressions:** `npm run build` (Next.js 15 + TypeScript + Tailwind CSS v4) must compile cleanly without warnings or CSS errors.
