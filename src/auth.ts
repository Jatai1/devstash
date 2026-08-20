import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "@/auth.config";
import { signInSchema } from "@/lib/auth-schemas";
import { prisma } from "@/lib/prisma";

/**
 * The Credentials provider that actually authenticates, replacing the
 * placeholder in `auth.config.ts`. It lives here because it needs Prisma and
 * bcrypt, which cannot run in the edge runtime the proxy uses.
 *
 * Every failure returns `null` rather than a specific error: Auth.js puts the
 * reason in the redirect URL, and "no such email" versus "wrong password"
 * would tell an attacker which accounts exist.
 */
const credentials = Credentials({
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  authorize: async (raw) => {
    const parsed = signInSchema.safeParse(raw);

    if (!parsed.success) {
      return null;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true, image: true, password: true },
    });

    // A user created through GitHub has no password, so there is nothing to
    // compare against and this provider cannot sign them in.
    if (!user?.password) {
      return null;
    }

    if (!(await compare(password, user.password))) {
      return null;
    }

    return { id: user.id, name: user.name, email: user.email, image: user.image };
  },
});

/**
 * The full Auth.js setup: the edge-safe half from `auth.config.ts` plus the
 * pieces that need Node — the Prisma adapter and the singleton client.
 *
 * Only server code that already talks to the database should import this.
 * `src/proxy.ts` imports `auth.config.ts` instead.
 */
export const { auth, handlers, signIn, signOut } = NextAuth({
  // Spread first so nothing below can be silently overwritten by the config
  // half — `providers` in particular is replaced here on purpose.
  ...authConfig,

  // The adapter still persists users, accounts and verification tokens; the
  // `jwt` strategy only means the *session* lives in a cookie rather than the
  // `Session` table, which is what keeps the proxy free of database access.
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },

  // Same provider list the proxy sees, with the placeholder swapped for the
  // real check. Matching on `id` rather than position means adding a provider
  // to the config cannot quietly break the swap.
  providers: authConfig.providers.map((provider) =>
    typeof provider !== "function" && provider.id === "credentials"
      ? credentials
      : provider,
  ),

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
