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
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });

  if (!user) {
    throw new Error(
      `No user found for ${DEMO_USER_EMAIL} — run \`npx prisma db seed\`.`,
    );
  }

  return user.id;
});
