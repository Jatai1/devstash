import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer reads `.env` implicitly and no longer takes the connection
// URL from the `datasource` block in `schema.prisma` — both live here instead.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 dropped automatic seeding after `migrate dev` — run `prisma db seed`.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Used by the Prisma CLI (migrate, db execute, studio) only — the app itself
    // connects through the driver adapter in `src/lib/prisma.ts`.
    //
    // This must be Neon's *unpooled* endpoint: migrations need a session-level
    // connection that the PgBouncer-backed `-pooler` host cannot give them.
    // `directUrl` was removed in Prisma 7, so the direct URL goes here instead.
    url: env("DIRECT_URL"),
  },
});
