import "dotenv/config";

import { prisma } from "../src/lib/prisma";

/**
 * Grandfathers the password accounts that predate email verification.
 *
 * Verification was added after these users registered, and the sign-in gate
 * refuses any account whose `emailVerified` is null — so without this they
 * would be locked out of accounts they created legitimately, with no way back
 * in except a resend link for a feature that did not exist when they signed up.
 *
 * This is a data change, not a schema one, so it is a script rather than a
 * migration: replaying it on a fresh database would be a no-op, and it must not
 * become part of the migration history that `prisma migrate deploy` replays on
 * every environment.
 *
 * Only accounts created before it are touched. Anyone who registers
 * after it shipped has a real link waiting in their inbox and should use it.
 *
 * Run with: npx tsx scripts/backfill-email-verified.ts
 */

/**
 * The moment email verification shipped.
 *
 * Every password account that existed before this had no opportunity to verify
 * and is grandfathered; every account created at or after it received a real
 * link and is the feature's responsibility, not this script's.
 *
 * Hardcoded rather than `new Date()` so the script is idempotent — running it
 * again next week must not sweep up accounts that simply have not clicked their
 * link yet, which a moving "now" would do.
 */
const VERIFICATION_SHIPPED_AT = new Date("2026-08-20T22:45:36.000Z");

async function main() {
  const stale = await prisma.user.findMany({
    where: {
      emailVerified: null,
      createdAt: { lt: VERIFICATION_SHIPPED_AT },
      OR: [
        // Password accounts that predate the gate and would now be locked out.
        { password: { not: null } },
        // OAuth accounts, whose address the provider already verified. The
        // `linkAccount` event stamps these going forward, but it only fires the
        // first time an account is linked — an already-linked user would stay
        // null forever without this.
        { accounts: { some: {} } },
      ],
    },
    select: { id: true, email: true, createdAt: true },
  });

  if (stale.length === 0) {
    console.log("Nothing to backfill — every pre-verification account is already verified.");
    return;
  }

  console.log(`Backfilling ${stale.length} account(s):`);
  for (const user of stale) {
    console.log(`  ${user.email}  (created ${user.createdAt.toISOString()})`);
  }

  const { count } = await prisma.user.updateMany({
    where: { id: { in: stale.map((user) => user.id) } },
    // Stamped with the ship time rather than `now()`, so the column records when
    // these were grandfathered rather than implying the user clicked a link.
    data: { emailVerified: VERIFICATION_SHIPPED_AT },
  });

  console.log(`Updated ${count} row(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
