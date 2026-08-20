# Devstash

A developer knowledge hub for snippets, commands, prompts, notes, files, images, links, and custom types.

## Context Files

Read the following to get the full context of the project:

-@context/project-overview.md
-@context/coding-standards.md
-@context/ai-interaction.md
-@context/current-feature.md

## Commands

```bash
npm run dev      # dev server on http://localhost:3000
npm run build    # production build; type checks via project-local tsc and fails on errors
npm run start    # serve the production build (requires a prior build)
npm run lint     # bare `eslint` — flat config discovers files itself, no path args
npx tsc --noEmit # same type check as the build, without the bundling
```

`next lint` was removed in Next.js 16 and **`next build` no longer runs ESLint**, so
lint is a separate step that CI/`build` will not catch for you. `npx tsc --noEmit` is
the fast pre-check; the build repeats it.

There is no test framework installed. Do not invent one or assume a runner exists — if
tests are needed, ask which one to add first.

### Database commands

```bash
npx prisma migrate dev --name <name>  # author + apply a migration against the Neon dev branch
npx prisma migrate status             # what is applied vs. what is on disk
npx prisma db seed                    # runs `tsx prisma/seed.ts`; Prisma 7 does NOT seed automatically
npx prisma generate                   # regenerate the client into src/generated/prisma
npm run test:db                       # scripts/test-db.ts — row counts + a rolled-back round trip
```

Prisma config lives in the root `prisma.config.ts`, not `package.json`: v7 stopped
loading `.env` implicitly (the config imports `dotenv/config`) and dropped
`datasource.directUrl`, so the CLI reads the unpooled `DIRECT_URL` from there while the
app connects through the pooled `DATABASE_URL` and the `PrismaPg` adapter in
`src/lib/prisma.ts`. The client generates to `src/generated/prisma` — gitignored and
ESLint-ignored — with `postinstall: prisma generate` so fresh installs and deploys
still have it.

**Always use `prisma migrate` — never `db push`, and never edit the database directly.**

### Neon MCP: always the devstash project, always the development branch

Every Neon MCP call — `run_sql`, `run_sql_transaction`, `describe_branch`,
`get_database_tables`, `describe_table_schema`, `prepare_database_migration`,
`explain_sql_statement`, all of them — must be scoped to **this** project and to its
**development** branch:

- **Project:** `wandering-silence-70846346` (the only Neon project on the account, named
  "Jason's project" in the console — it is the Devstash database). Never operate on any
  other project, and never create, delete, or reset a project.
- **Branch:** pass the **`development`** branch's `branchId` — `br-crimson-cake-axnj0luc`,
  compute `ep-calm-boat-axkbmcbc` — explicitly on every call that accepts one. Never rely
  on the default-branch fallback: the account default is `production`, so an omitted
  `branchId` silently reads and writes production.

The local `.env` points both `DATABASE_URL` and `DIRECT_URL` at that development branch, so
`npm run dev`, `npm run test:db` and the Prisma CLI all stay off production. If those URLs
ever have to be replaced, check the endpoint before pasting: the Neon console hands out
production's string by default, and a rotation that way is how local development ended up
writing to production for several features.

**Production (`br-polished-bar-axbqcz56`) is off limits unless I name it in that turn.**
"Use production", "check prod", or an explicit branch ID counts as naming it; a general
request like "show me the collections" or "add a column" never does. Permission applies to
the single request that granted it and does not carry forward to later turns.

If the `development` branch does not exist or cannot be resolved, **stop and ask** — do
not fall back to `production`, and do not create the branch without asking first.

Reads are as scoped as writes here: querying production is still touching production, and
its rows may be real user data rather than seed data.


### Route component props are generated globals, not hand-written types

Next.js 16 writes `.next/types/routes.d.ts` during dev/build, declaring **global**
`PageProps<Route>` and `LayoutProps<Route>` keyed by literal route strings. Use them
instead of typing `{ children: React.ReactNode }` yourself:

```tsx
export default function RootLayout({ children }: LayoutProps<"/">) { ... }
export default async function Page({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
}
```

Both `params` and `searchParams` are **Promises** and must be awaited. The route union
only contains routes that exist, so referencing a route you haven't created yet is a
type error, and the types are stale until `next dev` or `next build` regenerates them.

### Tailwind v4 has no JS config file

Tailwind is wired in through `@tailwindcss/postcss` in `postcss.config.mjs`. There is no
`tailwind.config.js` and there should not be — theme customization in v4 goes in
`src/app/globals.css` inside an `@theme` / `@theme inline` block.

The create-next-app tokens were stripped at setup, then replaced wholesale when
shadcn/ui was initialized. `globals.css` now imports `tailwindcss`, `tw-animate-css`
and `shadcn/tailwind.css`, declares `@custom-variant dark (&:is(.dark *))`, and maps
the shadcn palette (`--color-background`, `--color-sidebar-*`, `--color-chart-*`, …)
plus `--font-sans` / `--font-mono` inside `@theme inline`. Geist Sans/Mono are loaded
via `next/font` in `layout.tsx`, which also hard-codes `dark` on `<html>` — dark mode
is the default and light mode is not built yet.

## AGENTS.md is machine-generated

`next dev` writes and re-adds the `nextjs-agent-rules` block in `AGENTS.md`. Deleting it
from a diff just recreates the uncommitted change; commit it alongside your work to keep
the tree clean.
