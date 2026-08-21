import "dotenv/config";

import { prisma } from "../src/lib/prisma";
import { tokenIdentifiersFor } from "../src/lib/tokens";

/**
 * Deletes every user and everything they own, except one account to keep.
 *
 * Dry run by default — it prints exactly what it would remove and changes
 * nothing. Pass `--confirm` to actually delete.
 *
 *   npx tsx scripts/prune-users.ts                      # dry run, keeps jason@test.com
 *   npx tsx scripts/prune-users.ts --confirm            # really delete
 *   npx tsx scripts/prune-users.ts other@example.com    # keep a different account
 *
 * System item types (`userId: null`) are never touched: they are shared by
 * every user and seeded by `prisma/seed.ts`, so removing them would break the
 * surviving account too.
 */

/** Kept unless a different address is passed as the first argument. */
const DEFAULT_KEEP_EMAIL = "jason@test.com";

/**
 * The Neon *production* compute, from `CLAUDE.md`.
 *
 * Local `.env` has pointed at production before — the Neon console hands out
 * production's connection string by default, and a credential rotation once
 * pasted it in, which is how development spent several features writing to
 * production. A destructive script is the worst possible place to repeat that,
 * so this one refuses to run there at all rather than asking nicely.
 */
const PRODUCTION_COMPUTE = "ep-dawn-star-axk1r6c6";

/** Host of the connection this run would delete from, for the banner. */
function describeTarget(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  try {
    return new URL(url).host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

interface Plan {
  users: { id: string; email: string | null; name: string | null }[];
  /** Every `VerificationToken.identifier` belonging to the doomed accounts. */
  tokenIdentifiers: string[];
  counts: Record<string, number>;
}

async function buildPlan(keepEmail: string): Promise<Plan> {
  const keeper = await prisma.user.findUnique({
    where: { email: keepEmail },
    select: { id: true },
  });

  // Refusing here is the difference between "delete everyone else" and "delete
  // everyone": a typo in the address would otherwise match nobody and take the
  // whole table with it.
  if (!keeper) {
    throw new Error(
      `No user found with email ${keepEmail} — refusing to run, since that would delete every account.`,
    );
  }

  const users = await prisma.user.findMany({
    where: { id: { not: keeper.id } },
    select: { id: true, email: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const userIds = users.map((user) => user.id);

  // Every namespace, not just the bare address: a pending password-reset row is
  // stored under `password-reset:<email>` and would otherwise be left orphaned.
  const tokenIdentifiers = users
    .map((user) => user.email)
    .filter((email): email is string => Boolean(email))
    .flatMap(tokenIdentifiersFor);

  if (userIds.length === 0) {
    return { users, tokenIdentifiers, counts: {} };
  }

  const owned = { userId: { in: userIds } };

  const [items, collections, tags, customTypes, accounts, sessions, tokens] =
    await Promise.all([
      prisma.item.count({ where: owned }),
      prisma.collection.count({ where: owned }),
      prisma.tag.count({ where: owned }),
      prisma.itemType.count({ where: owned }),
      prisma.account.count({ where: owned }),
      prisma.session.count({ where: owned }),
      tokenIdentifiers.length
        ? prisma.verificationToken.count({
            where: { identifier: { in: tokenIdentifiers } },
          })
        : Promise.resolve(0),
    ]);

  return {
    users,
    tokenIdentifiers,
    counts: {
      items,
      collections,
      tags,
      "custom item types": customTypes,
      accounts,
      sessions,
      "verification tokens": tokens,
    },
  };
}

async function prune(plan: Plan): Promise<void> {
  const userIds = plan.users.map((user) => user.id);
  const owned = { userId: { in: userIds } };

  // Explicit order rather than leaning on `user.delete()`'s cascade. Every
  // relation off User does cascade, but `Item.itemType` is a required relation
  // with no `onDelete`, which Prisma defaults to Restrict — so a user's own
  // custom item type cannot be removed while their items still reference it,
  // and the order the database happens to process one big cascade in is not
  // something to bet a delete on. Items go first, which releases that
  // reference; ItemTag and ItemCollection cascade from Item and Collection.
  await prisma.$transaction([
    prisma.item.deleteMany({ where: owned }),
    prisma.collection.deleteMany({ where: owned }),
    prisma.tag.deleteMany({ where: owned }),

    // `userId: { in: [...] }` never matches NULL, so the shared system types
    // are excluded by construction rather than by a filter that could be
    // dropped later.
    prisma.itemType.deleteMany({ where: owned }),

    // Accounts and sessions would cascade from the user, but deleting them
    // here keeps every table this script touches visible in one place.
    prisma.account.deleteMany({ where: owned }),
    prisma.session.deleteMany({ where: owned }),

    // VerificationToken has no foreign key to User — it keys on the email
    // address — so nothing removes these when the account goes. Without this
    // they linger as orphans until they expire, and no job sweeps them.
    ...(plan.tokenIdentifiers.length
      ? [
          prisma.verificationToken.deleteMany({
            where: { identifier: { in: plan.tokenIdentifiers } },
          }),
        ]
      : []),

    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

async function main() {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");
  const keepEmail =
    args.find((arg) => !arg.startsWith("--")) ?? DEFAULT_KEEP_EMAIL;

  const host = describeTarget();

  if (host.includes(PRODUCTION_COMPUTE)) {
    throw new Error(
      `DATABASE_URL points at the production compute (${PRODUCTION_COMPUTE}). Refusing to run.`,
    );
  }

  console.log(`Database: ${host}`);
  console.log(`Keeping:  ${keepEmail}`);
  console.log("");

  const plan = await buildPlan(keepEmail);

  if (plan.users.length === 0) {
    console.log("Nothing to do — no other users exist.");
    return;
  }

  console.log(`Users to delete (${plan.users.length}):`);
  for (const user of plan.users) {
    console.log(`  ${user.email ?? "(no email)"}  ${user.name ?? ""}`.trimEnd());
  }

  console.log("");
  console.log("Rows to delete:");
  for (const [label, count] of Object.entries(plan.counts)) {
    console.log(`  ${String(count).padStart(4)}  ${label}`);
  }
  console.log("        (item/collection and item/tag links cascade from these)");
  console.log("");

  if (!confirm) {
    console.log("Dry run — nothing was deleted. Re-run with --confirm to proceed.");
    return;
  }

  await prune(plan);

  console.log(`Deleted ${plan.users.length} user(s) and everything they owned.`);

  const [remainingUsers, systemTypes] = await Promise.all([
    prisma.user.count(),
    prisma.itemType.count({ where: { userId: null } }),
  ]);

  console.log(`Remaining: ${remainingUsers} user(s), ${systemTypes} system item type(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
