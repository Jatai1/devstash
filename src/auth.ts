import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "@/auth.config";
import { EMAIL_NOT_VERIFIED_CODE, RATE_LIMITED_CODE } from "@/lib/auth-errors";
import { signInSchema } from "@/lib/auth-schemas";
import { isEmailVerificationEnabled } from "@/lib/email-verification";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { limitByIpAndEmail, resetIpAndEmailLimit } from "@/lib/rate-limit";

/**
 * Thrown when the password was right but the address was never confirmed.
 *
 * This is the one `authorize` failure that gets its own code. Auth.js puts
 * `code` in the redirect URL, so it must not hint at anything sensitive — but
 * by this point the caller has already proven they know the account's password,
 * so telling them the address is unverified reveals nothing they could not
 * already infer, and without it they would be stuck on "email and password do
 * not match" for a password that is in fact correct.
 */
class EmailNotVerifiedError extends CredentialsSignin {
  code = EMAIL_NOT_VERIFIED_CODE;
}

/**
 * Thrown when this IP has spent its sign-in budget for the address it is
 * guessing at.
 *
 * Safe to name, because it describes the caller's own request rate rather than
 * anything about the account — an attacker learns only that they are being
 * throttled, which they can already tell.
 */
class RateLimitedError extends CredentialsSignin {
  code = RATE_LIMITED_CODE;
}

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

    // Counted here rather than in the Server Action because this is the one
    // place every path funnels through: the form, a direct POST to
    // `/api/auth/callback/credentials`, and any future client all reach it.
    // Limiting only the action would leave the callback route wide open, which
    // is the brute-force case this feature exists to stop.
    //
    // Spent before the lookup and the bcrypt compare, so a throttled caller
    // costs neither a query nor a 12-round hash.
    const rate = await limitByIpAndEmail("signIn", email);

    if (!rate.success) {
      throw new RateLimitedError();
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        password: true,
        emailVerified: true,
      },
    });

    // A user created through GitHub has no password, so there is nothing to
    // compare against and this provider cannot sign them in.
    if (!user?.password) {
      return null;
    }

    if (!(await verifyPassword(password, user.password))) {
      return null;
    }

    // Checked only after the password matches, so an unverified-account
    // response cannot be used to probe which addresses are registered.
    //
    // The flag has to be honoured here as well as at registration: accounts
    // that were already sitting at `emailVerified: null` before it was turned
    // off would otherwise stay locked out, and "verification disabled" that
    // only applies to new accounts is not really disabled.
    if (isEmailVerificationEnabled() && !user.emailVerified) {
      throw new EmailNotVerifiedError();
    }

    // The window is cleared only once the sign-in has fully succeeded, so
    // someone who mistyped their password four times and then got it right does
    // not stay one attempt away from a lockout. Only failures should count
    // toward a brute-force budget.
    await resetIpAndEmailLimit("signIn", email);

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

  events: {
    /**
     * OAuth accounts arrive verified, but the Prisma adapter does not stamp
     * `emailVerified` for them — it only does so for the Email provider. That
     * left the column claiming a GitHub user's address was unconfirmed when
     * GitHub had already confirmed it. Harmless while the gate lives inside
     * `authorize` (an OAuth-only user has no password and never reaches it),
     * but the column should not lie, and anything later that reads it would
     * inherit the bug.
     */
    async linkAccount({ user }) {
      if (user.id) {
        await prisma.user.update({
          where: { id: user.id },
          data: { emailVerified: new Date() },
        });
      }
    },
  },

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
