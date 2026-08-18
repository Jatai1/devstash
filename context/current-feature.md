# Current Feature

<!-- Feature Name -->

Dashboard UI — Phase 1 (layout shell)

Spec: @context/features/dashboard-phase-1-spec.md

## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

<!-- Goals & requirements -->

Phase 1 of 3 for the dashboard UI. This phase builds the shell only — the sidebar
and main area are placeholders that phases 2 and 3 fill in.

- Initialize shadcn/ui and install the components the dashboard needs
- Dashboard route at `/dashboard`
- Main dashboard layout plus any global styles it requires
- Dark mode by default
- Top bar with search and a "New Item" button (display only, no behavior)
- Placeholders for the sidebar and main area — just an `h2` reading "Sidebar" and
  one reading "Main" for now

## Notes

<!-- Any extra notes -->

- Reference the screenshot at @context/screenshots/dashboard-ui-main.png for the
  target look. It does not have to be exact.
- Mock data already exists at @src/lib/mock-data.ts (items, collections, item
  types, current user) — no database yet.
- Tailwind v4: theme tokens go in an `@theme` block in `src/app/globals.css`.
  There is no `tailwind.config.js` and there should not be one.
- Later phases: @context/features/dashboard-phase-2-spec.md and
  @context/features/dashboard-phase-3-spec.md

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
