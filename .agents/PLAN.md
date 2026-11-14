# SocialFlow — Step-by-Step Implementation Plan (PLAN)

**Methodology:** Spec-First (`PRD.md` → `SPEC.md` → `PLAN.md` → Implementation → Verification)  
**Target Workspace:** `frontend/`

---

## Step 1 — Audit & Spec Setup (Foundation)
- Inspect existing `frontend/` structure:
  - `frontend/package.json` (`next ^15.2.0`, `react ^19.0.0`, `tailwindcss ^4.3.5`, `framer-motion`, `lucide-react`, `zustand`, `zod`)
  - `frontend/next.config.mjs` (`/api/:path*` proxy rewrite to API Gateway `:8088`)
  - `frontend/app/` routes (`/`, `/community`, `/stories`)
  - `frontend/store/useSocialStore.ts` & `frontend/lib/actions/social.actions.ts`
- Author `.agents/PRD.md`, `.agents/SPEC.md`, and `.agents/PLAN.md`.

## Step 2 — Design Tokens & Global Styles (Foundation)
- Update `frontend/app/layout.tsx`:
  - Load Google Fonts: `Inter`, `Heebo`, `Plus Jakarta Sans`, and `JetBrains Mono`.
  - Apply Obsidian base (`#090A0F`), `#F8FAFC` text, bilingual `dir="auto"` readiness, and ambient glow orb layers.
- Update `frontend/app/globals.css`:
  - Preserve `@import "tailwindcss";` and existing legacy classes for backward compatibility during component migration.
  - Add Obsidian Liquid Glass CSS custom properties (`#090A0F`, `rgba(18, 21, 33, 0.72)`, `#6366F1`, `#8B5CF6`, `#10B981`, `#F43F5E`, `#F8FAFC`, `#94A3B8`, `#64748B`).
  - Add `.glass-bento`, `.glass-bento-interactive`, `.glass-dock`, custom dark scrollbars, and animation utilities (`animate-pulse-live`, `animate-shimmer`, `animate-spring-pop`, `animate-fade-up`).
- Verify CSS compilation via `npm run build`.

## Step 3 — Core Layout & Bento Navigation
- Implement `components/layout/AppShell.tsx` (3-column asymmetric desktop grid `260px | minmax(0,640px) | 340px`, ambient glow orbs, responsive mobile sticky header + floating bottom glass dock).
- Implement `components/layout/LeftNavRail.tsx` (navigation items, WebSocket unread notification badge, user mini-profile pill, gradient **New Post** CTA).
- Implement `components/layout/RightBentoSidebar.tsx` (Search trigger card, Trending Hashtags & Communities Bento card, Who to Follow + Live Kafka/WS Telemetry badge).
- Implement `components/feed/FeedHeaderTabs.tsx` (`For You`, `Following`, `Trending`, `Media` sticky `backdrop-blur-xl` switcher).

## Step 4 — Composer, Feed & Post Cards
- Build `components/composer/PostComposerCard.tsx` with:
  - Drag-and-drop MinIO S3 presigned media upload + progress bar + multi-image preview grid.
  - Interactive Poll Builder toggle.
  - Markdown/code snippet formatting, hashtag autocomplete, and SVG character ring indicator.
- Build `components/feed/PostCard.tsx` with:
  - Hover elevation (`border-white/10` → `border-indigo-500/40`), verification badge, `dir="auto"` content typography.
  - Pinterest/Bento multi-image grid + lightbox preview.
  - Interactive poll voting bars + connected thread reply lines.
  - Spring-animated reaction micro-bar (`Like` with Rose `#F43F5E`, `Repost`, `Bookmark`, `Share`, `Comment`) + skeleton loaders.

## Step 5 — Profile Bento View, Auth Pages & Instant Search
- Build `components/profile/BentoProfileHeader.tsx` (hero banner, glass avatar card, 4-tile Bento stats grid, edit profile modal, media/posts/likes tabs).
- Build `components/search/CommandSearchModal.tsx` (`Ctrl+K` / `Cmd+K` Elasticsearch instant search across posts, users, and hashtags + AI RAG Feed Q&A trigger).
- Upgrade Login/Register split-screen glass auth views and connect `/stories` + `/(social)/community` routes to the new `AppShell`.

## Step 6 — Build Verification & GitHub Push
- Run `npm run build` (and TypeScript typecheck `npx tsc --noEmit`) inside `frontend/` (on Windows: `cmd /c npm run build`).
- Smoke-test all routes (`/`, `/community`, `/stories`, profile, auth) and verify API Gateway `/api/**` + WebSocket STOMP + MinIO/Elasticsearch integrations remain intact.
- Fix any TypeScript, lint, or CSS issues, then commit and push to GitHub.
