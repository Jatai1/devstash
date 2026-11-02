# Devstash

A personal knowledge hub for developers. It keeps the snippets, AI prompts, shell
commands, notes and links that usually end up scattered across editors, chat history
and bookmarks in one place.

> **Status: early development.** Accounts and full item CRUD work end to end. Collections,
> search, favorites/pins, file uploads, billing and AI features are not built yet. See
> [What works today](#what-works-today) for the exact line.

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Actions, `proxy.ts`), React 19 with the React Compiler |
| Language | TypeScript |
| Database | PostgreSQL on Neon, through Prisma 7 and the `@prisma/adapter-pg` driver adapter |
| Auth | NextAuth v5 (Auth.js): email/password and GitHub OAuth, JWT sessions |
| Email | Resend (verification and password-reset mail) |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`, sliding windows) |
| UI | Tailwind CSS v4, shadcn/ui on Radix, lucide icons, sonner toasts |
| Editors | Monaco (`@monaco-editor/react`) for code, `react-markdown` + `remark-gfm` for Markdown |
| Validation | Zod 4 |
| Tests | Vitest |

## What works today

### Accounts and authentication

- **Register with email and password** (`/register`). Passwords are hashed with bcrypt.
- **Email verification.** A verification link is mailed on registration (`/check-email`,
  `/verify-email`), and unverified accounts can't sign in. You can ask for a new link.
  Setting `EMAIL_VERIFICATION_ENABLED=false` turns verification off completely.
- **Sign in** with credentials or **GitHub OAuth** (`/sign-in`).
- **Forgot / reset password** through an emailed link that expires (`/forgot-password`,
  `/reset-password`). Tokens are random, stored only as SHA-256 hashes, and separated by
  namespace so a verification token can't be used as a reset token or the other way round.
- **Rate limiting** on sign-in, registration, forgot password, reset password and
  resend-verification. If Upstash isn't configured it **fails open** (see
  [Environment variables](#environment-variables)).
- **Route protection.** `/dashboard`, `/items/*` and `/profile/*` redirect anonymous
  visitors to sign-in, with a `callbackUrl` that brings them back afterwards.

### Profile

- `/profile` shows your avatar, name, email, member-since date and item and collection
  counts, including a breakdown by type.
- **Change password** (`/profile/change-password`). Only shown for accounts that have a
  password, not GitHub-only accounts.
- **Delete account** (`/profile/delete-account`). Removes the user along with everything
  they own.

### Dashboard

- `/dashboard` shows stat counters, recent collections, pinned items and recent items.
- A collapsible sidebar lists every item type with its count (`file` and `image` carry a
  **Pro** badge), your collections, and a user menu with Profile and Sign out. The sidebar
  becomes a drawer on mobile.

### Items

Every item has a **type**. Seven system types are seeded:

| Type | Stored as | Rendering |
|---|---|---|
| Snippets, Commands | text | Monaco code editor with syntax highlighting by language |
| Notes, Prompts | text | Markdown editor with Write / Preview tabs (GitHub-flavoured Markdown) |
| Links | URL | `http(s)://` URL |
| Files, Images 🔒 | file | Listed, but not creatable yet (no upload storage) |

- **List by type**: `/items/snippets`, `/items/prompts`, `/items/notes`, and so on.
- **Detail drawer**: click any item card to open it in a slide-out drawer showing its body,
  language, tags, collections and timestamps.
- **Create** from the **New Item** button in the top bar. Pick a type, then fill in title,
  description, tags (comma separated) and content / language / URL depending on the type.
- **Edit** in place inside the drawer.
- **Delete** from the drawer, after a confirmation dialog.
- **Copy** an item's content to the clipboard.

Every write goes through a Server Action that gets the user from the session and limits
every query to that user's rows. Another user's item gets the same answer as an id that
doesn't exist.

## Not built yet

These are planned (see [`context/project-overview.md`](context/project-overview.md)). Some
are already visible in the UI but don't work:

| Feature | Current state |
|---|---|
| Landing page | `/` only renders a heading |
| Collections | Seeded and shown on the dashboard/sidebar, but there is no create/edit UI. The **New Collection** button does nothing, and `/collections` / `/collections/[id]` don't exist yet (404) |
| Assigning items to collections | Shown in the drawer, not editable |
| Search | The top-bar search field (⌘K) is display only |
| Favorite / Pin | Buttons show the item's state but are disabled |
| File and image uploads | `R2_*` variables are listed in `.env.example`, but nothing is wired up |
| Custom item types | The schema supports them; there is no UI |
| Pro plan / Stripe billing | Schema columns exist. Free-plan limits (50 items, 3 collections, no files/images) are implemented in `src/lib/plan-limits.ts` but switched off (`PLAN_LIMITS_ENFORCED = false`) |
| AI features (auto-tag, summaries, explain code, prompt optimizer) | Not started |
| Import / export, light mode | Not started (dark mode is hard-coded) |

## Getting started

### Prerequisites

- Node.js 20.9 or newer (required by Next.js 16)
- A PostgreSQL database. The project targets [Neon](https://neon.tech) and expects both a
  pooled and a direct connection string.
- Optional: a GitHub OAuth app, a [Resend](https://resend.com) API key and an
  [Upstash](https://upstash.com) Redis database.

### Setup

```bash
git clone git@github.com:Jatai1/devstash.git
cd devstash
npm install                       # also runs `prisma generate`
cp .env.example .env              # then fill in the values below
npx auth secret                   # writes AUTH_SECRET
npx prisma migrate deploy         # apply the migrations
npx prisma db seed                # system item types + a demo account
npm run dev                       # http://localhost:3000
```

Prisma 7 does **not** seed automatically after a migration, so run `db seed` yourself.

The seed creates a demo account with sample collections and items:

```
email:    demo@devstash.io
password: 12345678
```

If you don't want to set up Resend locally, set `EMAIL_VERIFICATION_ENABLED=false` so
newly registered accounts can sign in straight away.

## Environment variables

[`.env.example`](.env.example) documents every variable in detail. In short:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Pooled Postgres URL, used by the app at runtime |
| `DIRECT_URL` | yes | Unpooled Postgres URL, used by the Prisma CLI for migrations |
| `AUTH_SECRET` | yes | Signs and encrypts the session JWT |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | for GitHub sign-in | OAuth app credentials. Callback: `http://localhost:3000/api/auth/callback/github` |
| `AUTH_URL` | in production | Absolute origin for links in emails. Defaults to `http://localhost:3000` |
| `EMAIL_VERIFICATION_ENABLED` | no | Only an explicit `false`/`0`/`off`/`no` turns verification off. Unset means on |
| `RESEND_API_KEY` | if verification is on | Sends verification and reset mail |
| `EMAIL_FROM` | no | Sender address. Defaults to Resend's sandbox sender, which only delivers to the Resend account owner |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | in production | Rate limiting. **If they're unset, nothing is rate limited** |
| `R2_*` | no | Reserved for file uploads. Not used yet |

`.env` is gitignored. Next.js reads it at startup, so restart the dev server after you
change it.

## Scripts

```bash
npm run dev        # dev server on http://localhost:3000
npm run build      # production build (also type checks)
npm run start      # serve the production build
npm run lint       # ESLint. `next build` no longer lints, so run this separately
npx tsc --noEmit   # type check only
npm test           # Vitest, single run (npm run test:watch to watch)
npm run test:db    # connect to the real database: row counts + a rolled-back write
```

Database:

```bash
npx prisma migrate dev --name <name>  # create and apply a new migration
npx prisma migrate status             # applied vs. on-disk migrations
npx prisma db seed                    # run prisma/seed.ts
npx prisma generate                   # regenerate the client into src/generated/prisma
```

Schema changes always go through `prisma migrate`. Never use `db push`.

Maintenance scripts in [`scripts/`](scripts/):

- `backfill-email-verified.ts`: one-off. Marks password accounts created before email
  verification shipped as verified.
- `prune-users.ts`: deletes every user except one. **Dry run by default.** Pass
  `--confirm` to actually delete.

## Testing

Vitest covers **Server Actions and utilities only** (`src/actions/**/*.test.ts` and
`src/lib/**/*.test.ts`). Test files anywhere else are ignored. Prisma, `@/auth` and
password hashing are mocked, so unit tests never touch a database. Components are checked
in the browser instead.

## Project structure

```
prisma/
  schema.prisma        # data model: User, Item, ItemType, Collection, Tag + Auth.js tables
  migrations/
  seed.ts              # system types + demo data
scripts/               # maintenance scripts (see above)
src/
  app/
    (auth)/            # signed-out pages: sign-in, register, verify, reset…
    (app)/             # signed-in shell with sidebar: dashboard, items/[slug], profile
    api/auth/          # Auth.js handler + POST /api/auth/register
    api/items/[id]/    # GET one item for the detail drawer
  actions/             # Server Actions: auth, password reset, profile, items
  components/          # auth, dashboard, profile, shadcn/ui
  lib/                 # db queries, schemas, tokens, email, rate limiting, plan limits
  auth.config.ts       # edge-safe Auth.js config (no Prisma)
  auth.ts              # full Auth.js config with Prisma adapter + credentials
  proxy.ts             # route protection (Next 16's renamed middleware)
context/               # product overview, coding standards, feature specs
docs/                  # item type reference, CRUD design, auth security review
```

### Two design decisions worth knowing

- **Auth is split across two files.** `src/proxy.ts` runs at the edge, so it creates its own
  NextAuth instance from `auth.config.ts`, which has no Prisma and no bcrypt. Importing
  `@/auth` there would break the build.
- **Server Actions are public endpoints.** Each one gets the user from `auth()` itself and
  never trusts an id from the request, even when the page that calls it is protected.

## Further reading

- [`context/project-overview.md`](context/project-overview.md): product vision, full
  feature list, data model and plan limits
- [`docs/item-types.md`](docs/item-types.md): the item type system
- [`docs/item-crud-architecture.md`](docs/item-crud-architecture.md): how item CRUD is laid
  out
- [`docs/audit-results/AUTH_SECURITY_REVIEW.md`](docs/audit-results/AUTH_SECURITY_REVIEW.md):
  security review of the auth layer
