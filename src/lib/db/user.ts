import { cache } from "react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * The user every dashboard query is scoped to.
 *
 * `cache` dedupes the lookup, so several server components on one page share a
 * single query per request.
 */
export const getCurrentUserId = cache(async (): Promise<string> => {
  const { id } = await getCurrentUser();

  return id;
});

/** The parts of a `User` the sidebar footer renders. */
export interface UserSummary {
  id: string;
  /** Null until the user sets one — the avatar falls back to their email. */
  name: string | null;
  email: string;
  /** Avatar URL, null when they have not uploaded one. */
  image: string | null;
}

/**
 * The signed-in user's profile, read from the Auth.js session and refreshed
 * from the database.
 *
 * The session is a JWT, so its `name`/`email`/`image` claims are whatever they
 * were when the token was issued and go stale after a profile edit. Only the id
 * is taken from it; the rest comes from the row.
 *
 * Throwing on a missing session is deliberate: `src/proxy.ts` guarantees one on
 * every route it matches, so reaching this means an unprotected route called a
 * function that only makes sense for a signed-in user. Callers should not have
 * to null-check what the proxy already established.
 */
export const getCurrentUser = cache(async (): Promise<UserSummary> => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    throw new Error(
      "No signed-in user. This route is missing from the `src/proxy.ts` matcher.",
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, image: true },
  });

  // The session outlives the row it points at: deleting a user leaves their
  // JWT valid until it expires, and it still carries their old id.
  if (!user) {
    throw new Error(`Session refers to user ${userId}, which no longer exists.`);
  }

  // `User.email` is nullable in the Auth.js schema, but every path that creates
  // one — the adapter, the register route and the seed — sets it.
  return { ...user, email: user.email ?? "" };
});
