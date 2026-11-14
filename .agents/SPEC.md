# SocialFlow — Technical & Design Specification (SPEC)

**Version:** 2.0 (Obsidian Liquid Glass Design System)  
**Target Directory:** `frontend/` (`Next.js 15.2`, `React 19`, `Tailwind CSS v4`, `Framer Motion`, `Lucide React`, `Zustand`)

---

## 1. Color Palette — Obsidian Liquid Glass

| Token | CSS Variable | Value / Utility | Usage |
| :--- | :--- | :--- | :--- |
| **Background Primary** | `--bg-primary` | `#090A0F` (`bg-[#090A0F]`) | Global viewport canvas |
| **Background Elevated / Bento Tile** | `--bg-bento` | `rgba(18, 21, 33, 0.72)` + `backdrop-blur-xl` | Cards, Bento modules, sticky rails |
| **Glass Surface Hover** | `--bg-bento-hover` | `rgba(24, 28, 44, 0.84)` | Interactive tile hover state |
| **Glass Border** | `--border-glass` | `1px solid rgba(255, 255, 255, 0.08)` (`border-white/10`) | Default hairline border |
| **Glass Border Hover** | `--border-glass-hover` | `rgba(99, 102, 241, 0.4)` (`hover:border-indigo-500/40`) | Active/focused glass tile border |
| **Electric Indigo** | `--accent-indigo` | `#6366F1` | Primary brand actions, active nav, links |
| **Cyber Violet** | `--accent-violet` | `#8B5CF6` | Secondary gradient stops, AI/Agent accents |
| **Emerald Live Pulse** | `--accent-emerald` | `#10B981` | Kafka/WebSocket live status, online indicators |
| **Rose Like Accent** | `--accent-rose` | `#F43F5E` | Like reaction active state & heart burst |
| **Text Primary** | `--text-primary` | `#F8FAFC` | Headings, post copy, primary labels |
| **Text Secondary** | `--text-secondary` | `#94A3B8` | Timestamps, handles, metadata |
| **Text Muted** | `--text-muted` | `#64748B` | Placeholders, subtle counters |

---

## 2. Typography & Bilingual Support
- **Sans Font Stack (`--font-sans`):** `'Inter', 'Heebo', 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif`
  - `Inter` & `Plus Jakarta Sans` provide crisp geometric Latin rendering.
  - `Heebo` delivers balanced, modern Hebrew typography at matching x-height.
- **Monospace Font Stack (`--font-mono`):** `'JetBrains Mono', ui-monospace, SFMono-Regular, monospace`
  - Used for engagement metrics, view counters, keyboard shortcuts (`Ctrl+K`), telemetry badges, and code snippets.
- **Directionality:**
  - Root `<html>` defaults to `lang="he" dir="rtl"` for the Hebrew-first experience while exposing `.dir-auto` (`unicode-bidi: plaintext`) and `dir="auto"` attributes on post content, comments, and inputs so English and Hebrew paragraphs align naturally.

---

## 3. Responsive Layout Grid
- **Desktop Container (`max-w-7xl mx-auto px-4 sm:px-6`):**
  - 3-column asymmetric CSS Grid:
    - **Left Rail:** `260px` sticky (`top-4`, `h-[calc(100vh-2rem)]`)
    - **Center Stream:** `minmax(0, 640px)` single-focus feed column
    - **Right Bento Sidebar:** `340px` sticky Bento module stack
- **Tablet (`md`–`lg`):** Left rail condenses to compact icon rail or collapses; Right Bento sidebar moves below or into drawer.
- **Mobile (`< md`):** Collapses into a **Sticky Top Glass Header** (`backdrop-blur-xl`) + **Bottom Floating Glass Dock** (`backdrop-blur-2xl`, `border-white/10`, safe-area padding).

---

## 4. Design System Utilities (`frontend/app/globals.css`)
- `@import "tailwindcss";` (Tailwind CSS v4 entry point preserved).
- `.glass-bento`: `background: var(--bg-bento)`, `backdrop-filter: blur(24px) saturate(180%)`, `border: 1px solid var(--border-glass)`, `border-radius: 20px`, inset top highlight, smooth border & elevation transition on hover.
- `.glass-bento-interactive`: Extends `.glass-bento` with `hover:border-indigo-500/40` (`rgba(99, 102, 241, 0.4)`) and subtle indigo glow shadow.
- `.glass-dock`: Floating mobile bottom bar / sticky header glass (`backdrop-blur-2xl`, `rgba(9, 10, 15, 0.78)`).
- **Ambient Glow Orbs (`.bg-orb`, `.orb-1`, `.orb-2`, `.orb-3`):** Fixed non-interactive radial gradients (`#6366F1`, `#8B5CF6`, `#10B981`/`#06B6D4`) softly illuminating `#090A0F`.
- **Custom Scrollbar:** Sleek `6px` dark obsidian track (`#090A0F`) with translucent `rgba(148, 163, 184, 0.25)` thumb and indigo hover accent.
- **Animation Utilities:**
  - `animate-pulse-live`: Emerald status ring pulse.
  - `animate-shimmer`: Skeleton loader gradient sweep.
  - `animate-spring-pop`: 200ms cubic-bezier spring pop for reaction icons.
  - `animate-fade-up`: Smooth card entrance transition (180ms–240ms).

---

## 5. Modular Component Architecture (`frontend/components/`)
> Note: Existing components under `frontend/components/social/` will be refactored/migrated into clean domain folders while preserving all props, Zustand store hooks (`frontend/store/useSocialStore.ts`), Zod schemas (`frontend/lib/validations/social.schema.ts`), and server actions (`frontend/lib/actions/social.actions.ts`).

| Module Path | Responsibility |
| :--- | :--- |
| `components/layout/AppShell.tsx` | 3-column responsive grid (`260px` \| `minmax(0,640px)` \| `340px`), ambient glow orbs, mobile header & floating dock |
| `components/layout/LeftNavRail.tsx` | Navigation links, unread WebSocket notification badge, user mini-profile pill, primary gradient **New Post** CTA |
| `components/layout/RightBentoSidebar.tsx` | 3 modular Bento cards: (1) Elasticsearch Instant Search & `Ctrl+K` trigger, (2) Trending Hashtags & Communities, (3) Who to Follow + Live System Telemetry badge (Kafka/WS indicator) |
| `components/feed/FeedHeaderTabs.tsx` | Sticky `backdrop-blur-xl` header with pinned feed pills (`For You`, `Following`, `Trending`, `Media`) |
| `components/composer/PostComposerCard.tsx` | Expandable glass composer with MinIO S3 upload progress bar, multi-image preview, Poll creator toggle, and character ring indicator |
| `components/feed/PostCard.tsx` | Glass card with hover elevation, author verification badge, `dir="auto"` content typography, Pinterest/Bento multi-image grid, connected thread lines, interactive poll bars, and spring-animated reaction buttons |
| `components/profile/BentoProfileHeader.tsx` | Profile banner, glass avatar card, 4-tile Bento stats grid (`Posts`, `Followers`, `Following`, `Engagement Impact`), and edit profile modal |
| `components/search/CommandSearchModal.tsx` | `Ctrl+K` / `Cmd+K` Elasticsearch instant search modal across posts, users, and hashtags + AI RAG shortcut |
| `components/ui/*` | Reusable Obsidian Liquid Glass primitives (skeletons, badges, character ring, lightbox modal) |

---

## 6. Backend & API Contracts (Preserved)
- **API Gateway Rewrites (`next.config.mjs`):** `/api/:path*` → `${API_GATEWAY_URL || 'http://localhost:8088'}/api/:path*`
- **Auth & Users:** `/api/auth/**`, `/api/users/**`, `/api/v1/users/**`
- **Posts & Polls:** `/api/posts/**`, `/api/v1/posts/**`
- **Feeds & Elasticsearch Search:** `/api/feed/**`, `/api/v1/feed/**`, `/api/v1/search/**`
- **Media (MinIO S3):** `/api/media/**`, `/api/v1/media/**`
- **AI & RAG (`ai-service`):** `/api/v1/ai/ask-feed`, `/api/v1/ai/analyze`, LangGraph agent endpoints
- **Real-Time Notifications:** WebSocket STOMP endpoint & Zustand `notifications` state
