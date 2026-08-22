import { isProItemType } from "@/lib/pro";
import { prisma } from "@/lib/prisma";

/**
 * The one place the free plan's caps are enforced.
 *
 * `context/project-overview.md` §6 sets the numbers and is explicit that
 * gating should be *"a config flip at launch, not a rebuild"* — so this exists
 * and is called now, while there is exactly one call site to hang it on.
 *
 * It deliberately does **not** live in `src/lib/pro.ts`. That module is
 * imported by `SidebarTypeNav`, which is a client component, so pulling Prisma
 * into it would drag the database client into the browser bundle. `pro.ts`
 * stays a pure statement of which types are Pro; this module is the part that
 * needs the database.
 *
 * It is not marked `server-only` either, matching every other Prisma-importing
 * module in `src/lib/db/`. What keeps it off the client is that nothing on the
 * client imports it — and `server-only` cannot currently be used by anything
 * under test, since the stub in `vitest.config.ts` does not actually take
 * effect (`rate-limit.ts` cannot be imported from a test for the same reason).
 */

/** Items a free account may hold. `context/project-overview.md` §6. */
export const FREE_ITEM_LIMIT = 50;

/** Collections a free account may hold. Unused until collection create exists. */
export const FREE_COLLECTION_LIMIT = 3;

/**
 * The launch switch.
 *
 * Every user has full access during development, so this is `false` and
 * `checkPlanLimits` returns before it queries anything — the check costs
 * nothing today. Flipping it to `true` turns the caps on with no other change,
 * which is the whole point of the seam.
 *
 * The rule it guards is **not** dead code: `evaluatePlanLimits` is exported and
 * unit tested on its own, so the flip turns on a path that has been run rather
 * than one that never has.
 */
export const PLAN_LIMITS_ENFORCED = false;

/**
 * Whether this user may create one more item of this type.
 *
 * Returns `null` when allowed, or the sentence to show them when not — the
 * same flat shape the actions report, so the caller can hand it straight to
 * `error` without translating anything.
 *
 * **The check belongs here, in the action's path, not in the component.** A
 * hidden "New Item" button is not enforcement, for the same reason being
 * rendered behind the proxy is not authorization: a Server Action is a public
 * endpoint and has to decide for itself.
 */
export async function checkPlanLimits(
  userId: string,
  itemType: { name: string },
): Promise<string | null> {
  if (!PLAN_LIMITS_ENFORCED) {
    return null;
  }

  return evaluatePlanLimits(userId, itemType);
}

/**
 * The rule itself, separated from the switch that decides whether to apply it.
 *
 * Split out so the launch behaviour can be tested directly. Folded into
 * `checkPlanLimits`, the enforced branch would be unreachable from a test while
 * the constant is `false` — and a test that re-implemented it to get around
 * that would be asserting about a copy, not about what ships.
 */
export async function evaluatePlanLimits(
  userId: string,
  itemType: { name: string },
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPro: true },
  });

  // A session naming a deleted row is the caller's problem, not a plan
  // decision — the write that follows will fail its own foreign key. Refusing
  // here with a billing sentence would be a confusing lie.
  if (!user || user.isPro) {
    return null;
  }

  if (isProItemType(itemType.name)) {
    return "Files and images are a Pro feature. Upgrade to save them.";
  }

  const items = await prisma.item.count({ where: { userId } });

  if (items >= FREE_ITEM_LIMIT) {
    return `Free accounts can save up to ${FREE_ITEM_LIMIT} items. Upgrade for unlimited.`;
  }

  return null;
}
