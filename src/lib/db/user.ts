import { cache } from "react";

import { prisma } from "@/lib/prisma";

/** The account `prisma/seed.ts` creates. */
const DEMO_USER_EMAIL = "demo@devstash.io";

/**
 * The user every dashboard query is scoped to.
 *
 * There is no auth yet, so this resolves the seeded demo account. Once Auth.js
 * is wired up this reads the session instead, and nothing else has to change —
 * every caller already treats the id as "whoever is signed in".
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
 * The signed-in user's profile. Shares `getCurrentUserId`'s caveat: it resolves
 * the seeded demo account until Auth.js lands, and is cached per request.
 */
export const getCurrentUser = cache(async (): Promise<UserSummary> => {
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true, name: true, email: true, image: true },
  });

  if (!user) {
    throw new Error(
      `No user found for ${DEMO_USER_EMAIL} — run \`npx prisma db seed\`.`,
    );
  }

  // `User.email` is nullable in the Auth.js schema, but it is the column this
  // lookup matched on, so a returned row always has one.
  return { ...user, email: user.email ?? DEMO_USER_EMAIL };
});
