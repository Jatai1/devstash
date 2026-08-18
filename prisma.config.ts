import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads `.env` implicitly and no longer takes the connection
// URL from the `datasource` block in `schema.prisma` — both live here instead.

// `env("DIRECT_URL")` from `prisma/config` throws while this module is still being
// evaluated when the variable is unset, so the whole config file fails to load —
// which is what breaks `prisma generate` in the `postinstall` step of a deploy that
// only has the runtime `DATABASE_URL`. `generate` needs no datasource URL at all, so
// omit the datasource rather than crash; the migration commands that do need it
// report a missing URL themselves.
const directUrl = process.env.DIRECT_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // Prisma 7 dropped automatic seeding after `migrate dev` — run `prisma db seed`.
    seed: "tsx prisma/seed.ts",
  },
  // Used by the Prisma CLI (migrate, db execute, studio) only — the app itself
  // connects through the driver adapter in `src/lib/prisma.ts`.
  //
  // `DIRECT_URL` must be Neon's *unpooled* endpoint: migrations need a session-level
  // connection that the PgBouncer-backed `-pooler` host cannot give them.
  // `directUrl` was removed in Prisma 7, so the direct URL goes here instead.
  datasource: directUrl ? { url: directUrl } : undefined,
});
