import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Returned by `auth()`, `useSession()` and `getSession()`.
   *
   * Every dashboard query is scoped to a user id, so `session.user.id` is the
   * property callers actually reach for. Auth.js does not declare it by
   * default, and `src/auth.ts` fills it from the JWT's `sub` claim.
   */
  interface Session {
    user: {
      id: string;
      // Spread the defaults back in — declaring `user` above would otherwise
      // replace `name`, `email` and `image` rather than extend them.
    } & DefaultSession["user"];
  }
}
