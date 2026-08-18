/**
 * Seeds the development database with the sample data in
 * `context/features/seed-spec.md`: the demo user, the seven immutable system
 * item types, and five collections holding eighteen items.
 *
 * Run with: npx prisma db seed
 *
 * This is a one-shot seed, not an idempotent one. Running it twice fails on the
 * demo user's unique email rather than quietly duplicating collections and
 * items. The system item types are the exception — see `seedSystemItemTypes`.
 */
import "dotenv/config";

import { hash } from "bcryptjs";

import { prisma } from "@/lib/prisma";

const DEMO_EMAIL = "demo@devstash.io";
const DEMO_PASSWORD = "12345678";
const BCRYPT_ROUNDS = 12;

/**
 * Colours and Lucide icon names come from `context/features/seed-spec.md`.
 * `label`, `slug` and `contentKind` are not in that table but are required by
 * the schema, so they are carried over from the previous seed.
 */
const SYSTEM_ITEM_TYPES = [
  { name: "snippet", label: "Snippets", slug: "snippets", icon: "Code", color: "#3b82f6", contentKind: "TEXT" },
  { name: "prompt", label: "Prompts", slug: "prompts", icon: "Sparkles", color: "#8b5cf6", contentKind: "TEXT" },
  { name: "command", label: "Commands", slug: "commands", icon: "Terminal", color: "#f97316", contentKind: "TEXT" },
  { name: "note", label: "Notes", slug: "notes", icon: "StickyNote", color: "#fde047", contentKind: "TEXT" },
  { name: "file", label: "Files", slug: "files", icon: "File", color: "#6b7280", contentKind: "FILE" },
  { name: "image", label: "Images", slug: "images", icon: "Image", color: "#ec4899", contentKind: "FILE" },
  { name: "link", label: "Links", slug: "links", icon: "Link", color: "#10b981", contentKind: "URL" },
] as const;

const TAG_NAMES = [
  "typescript",
  "react",
  "hooks",
  "utilities",
  "ai",
  "code-review",
  "documentation",
  "refactoring",
  "docker",
  "ci-cd",
  "deployment",
  "git",
  "shell",
  "npm",
  "css",
  "tailwind",
  "design-system",
  "icons",
] as const;

type TagName = (typeof TAG_NAMES)[number];

/**
 * System types carry `userId: null`, and Postgres treats NULLs as distinct in a
 * unique index — so `@@unique([userId, name])` never matches an existing row and
 * `upsert` would insert a duplicate set on every run. Match explicitly instead.
 * This runs against a database that may already hold these seven rows.
 */
async function seedSystemItemTypes() {
  const types = new Map<string, string>();

  for (const type of SYSTEM_ITEM_TYPES) {
    const existing = await prisma.itemType.findFirst({
      where: { name: type.name, userId: null },
    });

    const row = existing
      ? await prisma.itemType.update({
          where: { id: existing.id },
          data: { ...type, isSystem: true },
        })
      : await prisma.itemType.create({
          data: { ...type, isSystem: true, userId: null },
        });

    types.set(type.name, row.id);
  }

  console.log(`  ${types.size} system item types`);
  return types;
}

async function seedDemoUser() {
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      name: "Demo User",
      isPro: false,
      emailVerified: new Date(),
      password: await hash(DEMO_PASSWORD, BCRYPT_ROUNDS),
    },
  });

  console.log(`  user ${user.email}`);
  return user;
}

async function seedTags(userId: string) {
  const tags = new Map<TagName, string>();

  for (const name of TAG_NAMES) {
    const tag = await prisma.tag.create({ data: { name, userId } });
    tags.set(name, tag.id);
  }

  console.log(`  ${tags.size} tags`);
  return tags;
}

interface SeedItem {
  title: string;
  description: string;
  type: "snippet" | "prompt" | "command" | "link";
  content?: string;
  language?: string;
  url?: string;
  tags: TagName[];
  isPinned?: boolean;
  isFavorite?: boolean;
}

interface SeedCollection {
  name: string;
  description: string;
  defaultType: "snippet" | "prompt" | "command" | "link";
  isFavorite?: boolean;
  items: SeedItem[];
}

const COLLECTIONS: SeedCollection[] = [
  {
    name: "React Patterns",
    description: "Reusable React patterns and hooks",
    defaultType: "snippet",
    isFavorite: true,
    items: [
      {
        title: "useDebounce",
        description: "Delays a rapidly changing value until it settles",
        type: "snippet",
        language: "typescript",
        tags: ["typescript", "react", "hooks"],
        isPinned: true,
        isFavorite: true,
        content: `import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}`,
      },
      {
        title: "useLocalStorage",
        description: "State that survives a reload, synced to localStorage",
        type: "snippet",
        language: "typescript",
        tags: ["typescript", "react", "hooks"],
        content: `import { useCallback, useSyncExternalStore } from "react";

export function useLocalStorage(key: string, fallback: string) {
  const value = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      return () => window.removeEventListener("storage", onChange);
    },
    () => window.localStorage.getItem(key) ?? fallback,
    () => fallback,
  );

  const setValue = useCallback(
    (next: string) => {
      window.localStorage.setItem(key, next);
      window.dispatchEvent(new StorageEvent("storage", { key }));
    },
    [key],
  );

  return [value, setValue] as const;
}`,
      },
      {
        title: "Theme context provider",
        description: "Compound provider + hook pair that throws outside its tree",
        type: "snippet",
        language: "typescript",
        tags: ["typescript", "react", "utilities"],
        isFavorite: true,
        content: `"use client";

import { createContext, use, useMemo, useState } from "react";

type Theme = "light" | "dark";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme() {
  const context = use(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}`,
      },
    ],
  },
  {
    name: "AI Workflows",
    description: "AI prompts and workflow automations",
    defaultType: "prompt",
    isFavorite: true,
    items: [
      {
        title: "Code review prompt",
        description: "Structured review focused on correctness over style",
        type: "prompt",
        tags: ["ai", "code-review"],
        isPinned: true,
        content: `Review the diff below as a senior engineer on this codebase.

Priorities, in order:
1. Correctness — logic errors, unhandled edge cases, race conditions.
2. Security — injection, authz gaps, leaked secrets.
3. Performance — N+1 queries, unnecessary re-renders, accidental O(n^2).
4. Clarity — naming and structure that will confuse the next reader.

For each finding give: the file and line, what breaks, and a concrete fix.
Skip anything a formatter or linter already enforces. If you find nothing
worth changing, say so instead of inventing suggestions.

Diff:
"""
{{diff}}
"""`,
      },
      {
        title: "Documentation generator",
        description: "Turns a module into reference docs with runnable examples",
        type: "prompt",
        tags: ["ai", "documentation"],
        content: `Write reference documentation for the module below.

Include:
- A one-paragraph summary of what it is for and when to reach for it.
- Every exported symbol: signature, parameters, return value, and what it throws.
- At least one runnable example per export, using realistic values.
- Any gotcha a caller would only discover by reading the source.

Match the voice of the existing docs: direct, present tense, no marketing.
Do not document private helpers.

Module:
"""
{{source}}
"""`,
      },
      {
        title: "Refactoring assistant",
        description: "Proposes a refactor plan before touching any code",
        type: "prompt",
        tags: ["ai", "refactoring"],
        isFavorite: true,
        content: `Propose a refactoring plan for the code below. Do not rewrite it yet.

Return:
1. What the code currently does, in two sentences.
2. The specific problems — duplication, tangled responsibilities, dead paths.
3. An ordered sequence of small, individually shippable steps.
4. The behaviour that must not change, and how to prove it after each step.

Prefer several safe steps over one large rewrite. Call out anything that
cannot be changed without a migration or a breaking API change.

Code:
"""
{{source}}
"""`,
      },
    ],
  },
  {
    name: "DevOps",
    description: "Infrastructure and deployment resources",
    defaultType: "snippet",
    items: [
      {
        title: "Multi-stage Dockerfile for Next.js",
        description: "Standalone output, non-root runtime, minimal final layer",
        type: "snippet",
        language: "dockerfile",
        tags: ["docker", "deployment"],
        isFavorite: true,
        content: `FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]`,
      },
      {
        title: "Migrate and deploy",
        description: "Applies pending migrations before starting the app",
        type: "command",
        language: "bash",
        tags: ["ci-cd", "deployment", "shell"],
        content: `npx prisma migrate deploy && npm run build && npm run start`,
      },
      {
        title: "Next.js deployment docs",
        description: "Official guide to deploying a Next.js application",
        type: "link",
        url: "https://nextjs.org/docs/app/getting-started/deploying",
        tags: ["deployment", "documentation"],
      },
      {
        title: "GitHub Actions documentation",
        description: "Workflow syntax and CI/CD reference",
        type: "link",
        url: "https://docs.github.com/en/actions",
        tags: ["ci-cd", "documentation"],
      },
    ],
  },
  {
    name: "Terminal Commands",
    description: "Useful shell commands for everyday development",
    defaultType: "command",
    items: [
      {
        title: "Undo the last commit, keep the changes",
        description: "Moves HEAD back one commit and leaves the work staged",
        type: "command",
        language: "bash",
        tags: ["git", "shell"],
        isPinned: true,
        content: `git reset --soft HEAD~1`,
      },
      {
        title: "Reclaim Docker disk space",
        description: "Removes stopped containers, unused networks and dangling images",
        type: "command",
        language: "bash",
        tags: ["docker", "shell"],
        content: `docker system prune --volumes -f`,
      },
      {
        title: "Kill whatever is on port 3000",
        description: "Finds the listening process and terminates it",
        type: "command",
        language: "bash",
        tags: ["shell", "utilities"],
        isFavorite: true,
        content: `lsof -ti tcp:3000 | xargs kill -9`,
      },
      {
        title: "Find outdated packages",
        description: "Lists dependencies behind their latest published version",
        type: "command",
        language: "bash",
        tags: ["npm", "shell"],
        content: `npm outdated --long`,
      },
    ],
  },
  {
    name: "Design Resources",
    description: "UI/UX resources and references",
    defaultType: "link",
    isFavorite: true,
    items: [
      {
        title: "Tailwind CSS documentation",
        description: "Utility class reference and v4 theme configuration",
        type: "link",
        url: "https://tailwindcss.com/docs",
        tags: ["css", "tailwind"],
        isPinned: true,
      },
      {
        title: "shadcn/ui",
        description: "Copy-in component library built on Radix and Tailwind",
        type: "link",
        url: "https://ui.shadcn.com",
        tags: ["design-system", "tailwind"],
        isFavorite: true,
      },
      {
        title: "Radix UI primitives",
        description: "Unstyled, accessible component primitives",
        type: "link",
        url: "https://www.radix-ui.com/primitives",
        tags: ["design-system", "css"],
      },
      {
        title: "Lucide icons",
        description: "The icon set used throughout the app",
        type: "link",
        url: "https://lucide.dev/icons",
        tags: ["icons", "design-system"],
      },
    ],
  },
];

const CONTENT_KIND_BY_TYPE = {
  snippet: "TEXT",
  prompt: "TEXT",
  command: "TEXT",
  link: "URL",
} as const;

async function seedCollections(
  userId: string,
  typeIds: Map<string, string>,
  tagIds: Map<TagName, string>,
) {
  let itemCount = 0;

  for (const seed of COLLECTIONS) {
    const collection = await prisma.collection.create({
      data: {
        name: seed.name,
        description: seed.description,
        isFavorite: seed.isFavorite ?? false,
        defaultTypeId: typeIds.get(seed.defaultType),
        userId,
      },
    });

    for (const item of seed.items) {
      await prisma.item.create({
        data: {
          title: item.title,
          description: item.description,
          contentType: CONTENT_KIND_BY_TYPE[item.type],
          content: item.content ?? null,
          language: item.language ?? null,
          url: item.url ?? null,
          isPinned: item.isPinned ?? false,
          isFavorite: item.isFavorite ?? false,
          userId,
          itemTypeId: typeIds.get(item.type)!,
          collections: { create: [{ collectionId: collection.id }] },
          tags: {
            create: item.tags.map((tag) => ({ tagId: tagIds.get(tag)! })),
          },
        },
      });
      itemCount += 1;
    }

    console.log(`  ${seed.name} (${seed.items.length} items)`);
  }

  return itemCount;
}

async function main() {
  console.log("Seeding system item types...");
  const typeIds = await seedSystemItemTypes();

  console.log("\nSeeding demo user...");
  const user = await seedDemoUser();
  const tagIds = await seedTags(user.id);

  console.log("\nSeeding collections...");
  const itemCount = await seedCollections(user.id, typeIds, tagIds);

  console.log(
    `\nDone — ${COLLECTIONS.length} collections, ${itemCount} items, ${tagIds.size} tags.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
