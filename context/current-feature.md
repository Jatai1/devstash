# Current Feature

<!-- Feature Name -->

Dashboard UI Phase 3 (main area) — see `context/features/dashboard-phase-3-spec.md`

## Status

<!-- Not Started|In Progress|Completed -->

In Progress

## Goals

<!-- Goals & requirements -->

Build the main content area to the right of the sidebar, per
`context/features/dashboard-phase-3-spec.md` and the
`context/screenshots/dashboard-ui-main.png` screenshot, using `src/lib/mock-data.ts`
directly until the database exists.

- 4 stats cards across the top: total items, total collections, favorite items,
  favorite collections (not in the screenshot)
- Recent collections
- Pinned items
- 10 most recent items

## Notes

<!-- Any extra notes -->

- The spec references `@src/lib/mock-data.js`; the actual file is
  `src/lib/mock-data.ts`.

## History

<!-- Keep this updated. Earliest to latest -->

- Project setup and boilerplate cleanup
- Scaffolded with `create-next-app`: Next.js 16.3.1 (App Router), React 19.2.8, TypeScript 5, Tailwind CSS v4 via `@tailwindcss/postcss`, ESLint 9 flat config
- Stripped the create-next-app boilerplate: removed the `public/*.svg` assets, reset `globals.css` to a bare `@import "tailwindcss"` (dropping the default `--background`/`--foreground` tokens), and cleared out the demo markup in `layout.tsx` and `page.tsx`
- Added the `context/` docs and project `CLAUDE.md`; committed as `chore: initial next.js and tailwind setup` and pushed to `git@github.com:Jatai1/devstash.git`
- Added the dashboard UI screenshots under `context/screenshots/` and referenced them from `project-overview.md`
- Added `src/lib/mock-data.ts` as the single source of truth for placeholder dashboard data (item types, collections, items, current user) until the database is wired up
- Started Dashboard UI Phase 1 (layout shell) per `context/features/dashboard-phase-1-spec.md`
- Initialized shadcn/ui (`radix` base, `nova` preset, neutral base color, Lucide icons) — wrote `components.json`, `src/lib/utils.ts` and the theme tokens in `globals.css`; added the `button`, `input` and `separator` components
- Wired `--font-sans`/`--font-mono` to the existing Geist `next/font` variables, and hard-coded `dark` on `<html>` so dark mode is the default
- Added the `/dashboard` route: `DashboardTopBar` (search + New Collection/New Item, display only) plus `Sidebar`/`Main` placeholders
- Phase 1 complete — `npm run build` and `npm run lint` pass, and `/dashboard` was verified in the browser; committed as `feat: add dashboard shell for phase 1` on branch `feat/dashboard-phase-1`
- Merged `feat/dashboard-phase-1` into `main`
- Started Dashboard UI Phase 2 (sidebar) per `context/features/dashboard-phase-2-spec.md` on branch `feat/dashboard-phase-2` — collapsible sidebar, item types linking to `/items/[slug]`, favorite and most recent collections, a user avatar footer, and a drawer on mobile
- Added the shadcn `sidebar`, `avatar` and `collapsible` components (which pulled in `sheet`, `tooltip`, `skeleton` and the `use-mobile` hook)
- Rewrote the generated `use-mobile` hook on `useSyncExternalStore` — the shipped version calls `setState` inside an effect, which the project's ESLint config rejects
- Built the sidebar out of `DashboardSidebar` (brand header + shell), `SidebarTypeNav` (collapsible "Types" group linking to `/items/[slug]`), `SidebarCollectionNav` (collapsible "Collections" group split into Favorites and Recent) and `SidebarUserMenu` (avatar, name, email, settings); added `src/lib/icons.ts` to resolve the Lucide icon names stored in the mock data
- The "Recent" list excludes collections already shown under Favorites, so no collection appears twice in the sidebar
- Wired `SidebarProvider`/`SidebarInset` into the dashboard layout, reading the `sidebar_state` cookie server-side so the open/closed state survives a reload, and replaced the top bar's dummy button with `SidebarTrigger`
- `/items/[slug]` and `/collections/[id]` routes do not exist yet, so those sidebar links 404 until later phases add them
- Phase 2 complete — `npm run build` and `npm run lint` pass, and `/dashboard` was verified in Chrome: off-canvas collapse on desktop, drawer on mobile, both group headers toggle, no console errors
- Started Dashboard UI Phase 3 (main area) per `context/features/dashboard-phase-3-spec.md` — stats cards, recent collections, pinned items and the 10 most recent items
