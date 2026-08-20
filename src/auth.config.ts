import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
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
  // Both halves need these: the proxy builds its redirect from `signIn`, and
  // Auth.js sends its own failures (a rejected callback, `OAuthAccountNotLinked`)
  // to `error`. Pointing `error` at the sign-in page keeps those on a form the
  // user can act on instead of Auth.js's built-in error screen.
  pages: {
    signIn: "/sign-in",
    error: "/sign-in",
  },

  providers: [
    GitHub,
    /**
     * A placeholder. The proxy has to know this provider exists — the field
     * shape and the `/api/auth/callback/credentials` route come from here —
     * but the real check needs bcrypt and Prisma, neither of which can run at
     * the edge. `src/auth.ts` swaps this entry for the one that authenticates.
     *
     * `authorize` returning `null` means nothing can sign in through this
     * instance, which is the safe failure mode if the swap is ever missed.
     */
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: () => null,
    }),
  ],
} satisfies NextAuthConfig;
