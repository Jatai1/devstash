# Current Feature: Add pro badge to sidebar

<!-- Feature Name -->

Add a PRO badge to the Files and Images types in the sidebar — see
`context/features/add-pro-badge-sidebar.md`

## Status

<!-- Not Started|In Progress|Completed -->

Completed

## Goals

<!-- Goals & requirements -->

- The Files and Images rows in the sidebar's "Types" nav carry a badge reading
  `PRO`, all uppercase
- The badge is built on the shadcn/ui `badge` component (already installed at
  `src/components/ui/badge.tsx`)
- The badge reads as clean and subtle — it marks the row without competing with
  the type label, its icon, or the existing item count
- No other type row gains a badge, and nothing else about the nav changes

## Notes

<!-- Any extra notes -->

- The nav lives in `src/components/dashboard/SidebarTypeNav.tsx` and renders one
  `SidebarMenuItem` per `ItemTypeNavSummary` from `getItemTypes()` in
  `src/lib/db/item-types.ts`
- Each row's right edge is already occupied by a `SidebarMenuBadge` holding the
  item count, so the PRO badge needs a home inside the row's `Link` — next to
  the label — rather than in the trailing slot
- Which types are Pro is a product fact, not a database one: `ItemType` has no
  Pro column, and `project-overview.md` §5 marks `file` 🔒 Pro and `image` 🔒 Pro
  in the item-type table. The badge is therefore driven by the type's stable
  `name` (`"file"` / `"image"`) or `slug` (`"files"` / `"images"`) — not by
  `label`, which is display text, and not by the signed-in user's `isPro`
- `project-overview.md` line 471 is explicit that Pro gating is stubbed and not
  enforced during development, so the badge is a static marker on those two
  types. Every user sees it, including the seeded `demo@devstash.io` whose
  `isPro` is `false`. This feature adds no gating
- `SidebarTypeNav` is a client component (`usePathname`), so the Pro lookup has
  to be a plain constant it can read, not a database call
- Correcting a guess made at load time: the sidebar is `collapsible="offcanvas"`,
  not `icon`, so there is no collapsed rail for the badge to overflow — the whole
  panel slides away. No icon-mode guard was needed
- Implemented on branch `feature/add-pro-badge-sidebar`:
  - `src/lib/pro.ts` holds `PRO_ITEM_TYPE_NAMES` (`file`, `image`) and
    `isProItemType(name)`. It keys off `ItemType.name` rather than `slug`, so
    renaming the `/items/[slug]` route cannot silently drop the badge
  - `ItemTypeNavSummary` gained `name`, and `getItemTypes()` selects it
  - The badge is a shadcn `Badge` with `variant="outline"`, shrunk to `h-4` with
    `px-1 text-[10px] font-semibold tracking-wider` and painted in
    `text-sidebar-foreground/60` / `border-sidebar-border` so it recedes next to
    the label
  - The label span needed an explicit `truncate`: `SidebarMenuButton` truncates
    via `[&>span:last-child]`, which would have landed on the badge instead
- Runtime verification was blocked for a while: the Neon credentials in `.env`
  had gone stale and both endpoints returned Postgres `28P01`
  (invalid password), so `/dashboard` 500s and `npm run test:db` failed on `main`
  too. `vercel env pull` could not recover them — `DATABASE_URL`/`DIRECT_URL`
  exist only for Production and Preview, and both are marked Sensitive, so the
  pull returns the literal `[SENSITIVE]`. The fix was new connection strings from
  the Neon console
- The refreshed `.env` points at a different endpoint (`ep-dawn-star-axk1r6c6`
  rather than the old `ep-weathered-bird-axjdlej1`), but the branch is fully
  migrated and seeded: 3 migrations applied, schema up to date, and 1 user,
  7 item types, 18 items, 5 collections, 18 tags
- Verified against the live database and the rendered page: the badge renders on
  exactly Files and Images and on no other row, the trailing item counts still
  render (4/3/5/0/0/0/6, summing to the 18 seeded items), the badge's overrides
  win over the base variant in the emitted class list, and the dev server logs no
  errors

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
- Started Dashboard UI Phase 3 (main area) on branch `feat/dashboard-phase-3` — build the content area to the right of the sidebar per `context/features/dashboard-phase-3-spec.md` and the `context/screenshots/dashboard-ui-main.png` screenshot, reading `src/lib/mock-data.ts` directly until the database exists: 4 stats cards across the top (total items, total collections, favorite items, favorite collections — the last two are not in the screenshot), recent collections, pinned items, and the 10 most recent items
- Added the shadcn `card` and `badge` components, plus `src/lib/format.ts` with a `formatShortDate()` helper pinned to UTC so the server and the client render the same date string
- Added `getItemType()` to `mock-data.ts` (a lookup map over `ITEM_TYPES`) to resolve the type behind an `Item.typeId` or a `Collection.dominantTypeId`
- Built the main area out of `DashboardStats` (four counters), `RecentCollections` (grid of the 6 most recently updated collections, built on `CollectionCard`), `PinnedItems` and `RecentItems` (both built on `ItemCard`); `TypeIcon` wraps the Lucide lookup in `createElement`, because a capitalized local trips the `react-hooks/static-components` lint rule
- Every counter and list is derived from the `ITEMS`/`COLLECTIONS` arrays rather than the stored `itemCount` fields, so the totals always match what the page renders; `RecentItems` excludes pinned items so nothing appears in both sections
- The whole main area is server components — the page still exports `metadata`, and nothing here needs state or event handlers
- `/collections/[id]` does not exist yet, so the collection card links 404 until a later phase adds that route
- Phase 3 complete — `npm run build`, `npm run lint` and `npx tsc --noEmit` pass; committed as `feat: build the dashboard main area for phase 3` on branch `feat/dashboard-phase-3`
- Merged `feat/dashboard-phase-3` into `main`, deleted the branch, and pushed `main` to `origin`
- Added `context/features/database-spec.md` and set the current feature to the Prisma 7 + Neon PostgreSQL setup — first backend work after three phases of UI on mock data
- Started the Prisma 7 + Neon setup on branch `feature/prisma-neon-setup`; installed `prisma@7.9.1`, `@prisma/client@7.9.1`, `@prisma/adapter-pg`, `pg`, `dotenv`, `tsx` and `@types/pg`
- Prisma 7 breaking changes that shaped the setup: config lives in a root `prisma.config.ts` rather than `package.json`, `.env` is no longer loaded implicitly so the config imports `dotenv/config`, the generator is `prisma-client` (not `prisma-client-js`) with a now-required `output`, the `datasource` block carries no `url`, and a driver adapter is mandatory — bare `new PrismaClient()` connects to nothing
- `datasource.directUrl` was removed in v7, which matters for Neon: migrations need a session-level connection the PgBouncer `-pooler` host cannot provide, so `prisma.config.ts` reads the unpooled `DIRECT_URL` while the runtime adapter uses the pooled `DATABASE_URL`
- The client generates to `src/generated/prisma` (gitignored, ESLint-ignored) rather than `node_modules`, with `postinstall: prisma generate` so fresh installs and deploy builds still have it
- Wrote `prisma/schema.prisma` from the `project-overview.md` §4.2 draft: the four Auth.js models plus `ItemType`, `Item`, `Collection`, `ItemCollection`, `Tag`, `ItemTag` and the `ItemContentKind` enum
- Added four indexes beyond the draft: FK indexes on `Account.userId`, `Session.userId` and `Collection.defaultTypeId`, plus `@@index([userId, isFavorite])` on `Collection` for the sidebar's favorite-collections query; `Tag` keeps only its `@@unique([userId, name])`, which already serves per-user lookups
- Added the singleton client at `src/lib/prisma.ts` — `PrismaPg` adapter plus a `globalThis` cache outside production so hot reload does not open a new pool per edit
- Documented both connection strings in `.env.example` and added a `!.env.example` negation, since the blanket `.env*` rule in `.gitignore` was swallowing it
- Applied `20260818165522_init` to the Neon development branch — 10 tables, 21 indexes, 10 `ON DELETE CASCADE` rules
- Added `scripts/test-db.ts` (`npm run test:db`): connects through the same pooled URL and adapter the app uses, reports row counts, then exercises a full create/relate/cascade round trip inside a transaction that always rolls back, so it leaves no rows and is safe to re-run
- Neither `scripts/test-db.ts` nor `prisma/seed.ts` can use top-level `await`: the project is not `"type": "module"`, so `tsx` treats a `.ts` file as CJS where top-level await is a hard error — both wrap their logic in `main()`
- Seeded the seven immutable system item types via `prisma/seed.ts` and a `migrations.seed` entry in `prisma.config.ts`; v7 no longer seeds automatically after `migrate dev`, so it runs as `npx prisma db seed`
- The seed cannot use `upsert`: system types have `userId: null`, and Postgres treats NULLs as distinct in a unique index, so `@@unique([userId, name])` never matches an existing row and every run would insert duplicates. It does `findFirst` then create-or-update instead, and system-type uniqueness is therefore only guaranteed in application code
- Deliberately did not add partial unique indexes (`... WHERE "userId" IS NULL`) to enforce that at the database level: `schema.prisma` cannot express an indexed `WHERE`, so Prisma would read them as drift and emit `DROP INDEX` on the next `migrate dev`
- `ItemType` needed three fields the §4.2 draft lacked, all of which the dashboard already consumes from `mock-data.ts`: `slug` (the `/items/[slug]` route segment), `contentKind` (which `ItemContentKind` the type produces) and `label` (the plural display name, kept separate from `name` so the UI's display text is not part of the row's identity)
- Added them in `20260818171507_add_item_type_slug_and_content_kind` and `20260818173042_add_item_type_label`, both hand-written on top of `prisma migrate diff` output: Prisma refuses to add a required column to a populated table, so each migration adds the column nullable, backfills it, then `SET NOT NULL` so a missed row fails loudly. Hand-writing a migration file is not the same as editing the database, which is still never done directly
- Verified the database and schema agree with `prisma migrate diff --from-config-datasource --to-schema`, which returns an empty migration
- Feature complete — `prisma migrate status` reports 3 migrations and the schema up to date, and `npx tsc --noEmit`, `npm run lint`, `npm run build` and `npm run test:db` all pass
- Nothing consumes the database yet: all nine dashboard components still import from `src/lib/mock-data.ts`, and the only importers of Prisma are `src/lib/prisma.ts` and the two scripts. Swapping the UI over is the next feature, and it still has to reconcile `Collection.dominantTypeId` vs. the schema's `defaultTypeId` and the mock's stored `itemCount` fields, which the schema derives from `ItemCollection`
- Committed as `feat: set up prisma 7 with neon postgres`, merged `feature/prisma-neon-setup` into `main`, pushed to `origin`, and deleted the branch
- Added `context/features/seed-spec.md` and set the current feature to seeding demo data — a demo user, the seven system item types, and five collections holding eighteen items, to replace `src/lib/mock-data.ts` as the dashboard's source of truth
- Started the seed on branch `feature/seed-demo-data` and installed `bcryptjs` (3.x ships its own types, so no `@types/bcryptjs`)
- Rewrote `prisma/seed.ts` around the spec: the demo user `demo@devstash.io` ("Demo User", `isPro: false`, `emailVerified` set, password `12345678` hashed with bcryptjs at 12 rounds), 18 per-user tags, then 5 collections holding 18 items
- Decided against re-run handling — a second run fails on the demo user's unique email rather than silently duplicating collections and items. The seven system item types keep their `findFirst` create-or-update path, since the database already held them from the previous feature and a plain `create` would have produced 14 rows
- Item split matches the spec: React Patterns 3 snippets, AI Workflows 3 prompts, DevOps 1 snippet + 1 command + 2 links, Terminal Commands 4 commands, Design Resources 4 links. Every text item carries real working content (hooks, a theme provider, three full prompt templates, a multi-stage Next.js Dockerfile, real shell commands) and every link points at live documentation
- The spec left three things open, resolved here: tags are seeded, four items are pinned (one per collection except DevOps) with six favourites and three favourite collections so the dashboard's pinned section and favourite counters are not empty, and each `Collection.defaultTypeId` is set to that collection's dominant type
- Verified against the live database: the stored hash is `$2b$12$…` and `compare("12345678", hash)` returns true while a wrong password returns false; 0 orphan items, 0 untagged items, 0 link items missing a `url`, 0 text items missing `content`
- Feature complete — `npx prisma db seed`, `npm run test:db`, `npx tsc --noEmit`, `npm run lint` and `npm run build` all pass; the database now holds 1 user, 7 item types, 5 collections, 18 items, 18 tags and 40 item-tag links
- The seeded user still disagrees with `mock-data.ts`, which has "John Doe" and `isPro: true` for the same email, so `SidebarUserMenu` will show a different name once the dashboard reads real data
- The Neon production branch still has no tables and has never been seeded
- Added `context/features/dashboard-collections-spec.md` and set the current feature to wiring the dashboard's recent-collections grid to the database — the first UI that reads real data instead of `src/lib/mock-data.ts`
- Started on branch `feature/dashboard-collections`; added `src/lib/db/` as the home for query functions, with `collections.ts` (`getRecentCollections`, `getCollectionStats`) and `user.ts`
- There is no auth yet, so `src/lib/db/user.ts` exposes `getCurrentUserId()`, which looks up the seeded `demo@devstash.io` account and is wrapped in React's `cache()` so the several server components on one page share a single query per request. When Auth.js lands it reads the session instead and no caller changes
- The card's dominant type is computed from the collection's items rather than read off `Collection.defaultTypeId` — that column is only a suggestion for new items and can disagree with what the collection holds. `defaultType` is the fallback for an empty collection
- `getRecentCollections` selects the item types through `ItemCollection` in one query and ranks them in JS (count desc, then label, so the icon row is stable); `itemCount` is the length of that relation, so the count and the icons can never disagree
- `CollectionCard` now takes a `CollectionSummary` instead of the mock `Collection`: `description` is nullable in the schema so it only renders when set, and the count is pluralized ("1 item")
- `RecentCollections` gained an empty state, which real data makes reachable and the mock array never did
- `DashboardStats` is now async and reads the two collection counters from the database; the two item counters still come off `ITEMS`, since items are a later feature
- Added `export const dynamic = "force-dynamic"` to the dashboard page so the build does not prerender one snapshot of the database into static HTML — `next build` now reports `/dashboard` as `ƒ (Dynamic)`
- The sidebar's collection nav still reads `mock-data.ts`, as do the pinned and recent item sections, so the page mixes real and mock data until those features land
- Verified against the live database and the rendered page: stats show 5 collections / 3 favorites, and the grid renders the 5 seeded collections newest-first with the right counts, descriptions and border colors — DevOps (2 links, 1 command, 1 snippet) correctly resolves to Links and shows three icons
- Feature complete — `npx tsc --noEmit`, `npm run lint` and `npm run build` all pass; committed as `feat: read dashboard collections from the database` on branch `feature/dashboard-collections`
- Next up: the dashboard's remaining mock consumers — the pinned and recent item lists, the sidebar's collection and type navs, and the two item counters in `DashboardStats` — plus the `/collections/[id]` route the cards link to, which still 404s
- Added `context/features/dashboard-items-spec.md` and set the current feature to reading the dashboard's pinned and recent item lists from the database, alongside the item counters in `DashboardStats`
- Started on branch `feature/dashboard-items`; added `src/lib/db/items.ts` with `getPinnedItems`, `getRecentItems` and `getItemStats`
- Extracted the item-type shape both card families render into `src/lib/db/item-types.ts` (`ItemTypeSummary` plus the `ITEM_TYPE_SELECT` used by every query); `collections.ts` now imports it instead of declaring its own `CollectionType`
- `getPinnedItems` and `getRecentItems` share one private `findItems(where, take?)`, since they differ only in their `isPinned` filter and whether they cap the result — the recent list still excludes pinned items so nothing renders twice
- Tag names are sorted alphabetically in JS: `ItemTag` carries no ordering column, so without a sort the badge row could reshuffle between renders
- `ItemCard` now takes an `ItemSummary`: `item.type` is non-null (`Item.itemTypeId` is required, unlike the mock's `getItemType()` lookup that could miss), so the icon, tile wash and left border no longer need fallbacks, and `description` is nullable so the paragraph only renders when set
- `formatShortDate` accepts `Date | string` now — Prisma returns a `Date` where the mock had an ISO string — and `<time dateTime>` gets `updatedAt.toISOString()`
- `DashboardStats` reads all four counters from the database and no longer imports `mock-data.ts`; the item counts come from two `prisma.item.count` calls rather than counting rendered rows, so the "Items" card shows every item, not just the ten the recent list caps at
- Verified against the live database and the rendered page: stats show 18 items / 5 collections / 6 favorite items / 3 favorite collections, the pinned section lists the 4 seeded pinned items newest-first, and the recent list holds 10 non-pinned items with their type colors, tags and dates
- Feature complete — `npx tsc --noEmit`, `npm run lint` and `npm run build` pass
- `mock-data.ts` is now only read by the three sidebar components (`SidebarTypeNav`, `SidebarCollectionNav`, `SidebarUserMenu`); the main dashboard area is entirely database-backed
- Added `context/features/stats-sidebar-spec.md` and set the current feature to the stats and sidebar work — verify the stats cards against the database and move the sidebar's type and collection navs off `mock-data.ts`
- Started on branch `feature/stats-sidebar`; the stats half of the spec was already satisfied by the previous feature, so the work was the sidebar plus the queries behind it
- Both sidebar navs call `usePathname` to highlight the active route, so they cannot query the database themselves — `DashboardSidebar` became an async server component that loads the types and collections and passes them down as props. `SidebarUserMenu` had no client hooks, so it awaits `getCurrentUser()` directly
- Added `getItemTypes()` to `src/lib/db/item-types.ts` rather than `items.ts` as the spec suggested: that file already existed to hold the item-type shape, and `items.ts` is about items. It returns the system types plus the user's custom ones, with a per-user filtered relation count so a shared system type reports only that user's items
- `ItemType` has no sort column, so the nav orders by `isSystem` desc, then `createdAt`, then `label` — system types lead, and the order is stable between renders
- The nav lists every type including ones the user has never used (Notes, Files and Images all show 0), and it renders `ItemType.label` — the plural display name — where the mock had `name`
- Split the collection query the way `items.ts` splits its item query: a private `findCollections(where, take?)` now backs both `getRecentCollections` and the new `getSidebarCollections`, which returns favorites and recents in one call. The `isFavorite: false` filter on the recents query is what keeps a starred collection from appearing twice
- Recent collections show a circle in the type's color instead of an item count, computed from the collection's items like the card's border is; favorites keep the amber star. The dot renders nothing for an empty collection with no default type, since there would be no color to show
- Added a "View all collections" row under both lists linking to `/collections`, which does not exist yet and 404s like the other sidebar links
- Added `getCurrentUser()` alongside `getCurrentUserId()` in `src/lib/db/user.ts`, both cached per request; `getCurrentUserId` now derives from it. `User.name` is nullable so the footer falls back to the email, and `User.email` is nullable in the Auth.js schema but is the column the lookup matched on
- Deleted `src/lib/mock-data.ts` — nothing imported it any more, and its "John Doe" user contradicted the seeded "Demo User"
- Verified against the live database and the rendered page: all 7 types link to the right `/items/[slug]` with counts 4/3/5/0/6/0/0 summing to the 18 seeded items, the 3 favorite collections show stars, Terminal Commands and DevOps show orange (Commands) and green (Links) dots, the footer reads "Demo User / demo@devstash.io", and the stats cards show 18 / 5 / 6 / 3
- Feature complete — `npx tsc --noEmit`, `npm run lint` and `npm run build` pass, and `/dashboard` is still reported as `ƒ (Dynamic)`
- No component reads mock data any more; the whole dashboard is database-backed. The open follow-ups are the routes the sidebar links to: `/items/[slug]` and `/collections`, plus `/collections/[id]`
- Loaded `context/features/add-pro-badge-sidebar.md` and set the current feature to adding a PRO badge to the sidebar's Files and Images type rows
