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

`globals.css` is currently stripped to a bare `@import "tailwindcss";`. The
create-next-app design tokens (`--background`, `--foreground`, the `bg-background` /
`text-foreground` utilities, dark-mode overrides) were intentionally removed, so those
utilities do not exist. Geist Sans/Mono are still loaded via `next/font` in
`layout.tsx` and their CSS variables are on `<html>`, but nothing maps them to
Tailwind's `font-sans` / `font-mono` — add `--font-sans: var(--font-geist-sans)` inside
an `@theme inline` block if that wiring is wanted back.

## AGENTS.md is machine-generated

`next dev` writes and re-adds the `nextjs-agent-rules` block in `AGENTS.md`. Deleting it
from a diff just recreates the uncommitted change; commit it alongside your work to keep
the tree clean.
