import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";

import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";

/**
 * The full Auth.js setup: the edge-safe half from `auth.config.ts` plus the
 * pieces that need Node — the Prisma adapter and the singleton client.
 *
 * Only server code that already talks to the database should import this.
 * `src/proxy.ts` imports `auth.config.ts` instead.
 */
export const { auth, handlers, signIn, signOut } = NextAuth({
  // The adapter still persists users, accounts and verification tokens; the
  // `jwt` strategy only means the *session* lives in a cookie rather than the
  // `Session` table, which is what keeps the proxy free of database access.
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  ...authConfig,
  callbacks: {
    session({ session, token }) {
      // Under the `jwt` strategy the `user` argument is undefined, so the id
      // comes off the token's subject claim instead.
      if (token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
});
