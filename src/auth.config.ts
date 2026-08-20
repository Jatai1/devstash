import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";

/**
 * The half of the Auth.js config that is safe to run at the edge.
 *
 * `src/proxy.ts` runs on every `/dashboard` request and only needs to read the
 * session cookie, so it initializes NextAuth from this file alone. The Prisma
 * adapter lives in `src/auth.ts` instead — Prisma cannot run in the edge
 * runtime, and importing it here would pull it into the proxy bundle.
 *
 * `GitHub` reads `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET` from the
 * environment on its own; there is nothing to pass it.
 */
export default {
  providers: [GitHub],
} satisfies NextAuthConfig;
