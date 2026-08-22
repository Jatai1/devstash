import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `@/lib/prisma` is the only boundary: this is about the policy, not Postgres.
 * `@/lib/pro` runs for real — which types are Pro is exactly what is under test.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    item: { count: vi.fn() },
  },
}));

const { prisma } = await import("@/lib/prisma");
const {
  checkPlanLimits,
  evaluatePlanLimits,
  FREE_ITEM_LIMIT,
  FREE_COLLECTION_LIMIT,
  PLAN_LIMITS_ENFORCED,
} = await import("@/lib/plan-limits");

const USER_ID = "user_1";
const SNIPPET = { name: "snippet" };
const FILE = { name: "file" };

beforeEach(() => {
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    isPro: false,
  } as never);
  vi.mocked(prisma.item.count).mockResolvedValue(0 as never);
});

describe("checkPlanLimits, as shipped", () => {
  it("ships with enforcement off", () => {
    // Every user has full access during development, per
    // `context/project-overview.md` §6. Flipping this is the launch change.
    expect(PLAN_LIMITS_ENFORCED).toBe(false);
  });

  it("allows everything and queries nothing while unenforced", async () => {
    expect(await checkPlanLimits(USER_ID, FILE)).toBeNull();

    // The seam costs nothing today: it returns before touching the database,
    // so no create pays for a check that cannot refuse.
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.item.count).not.toHaveBeenCalled();
  });

  it("exposes the free-plan numbers from the project overview", () => {
    expect(FREE_ITEM_LIMIT).toBe(50);
    expect(FREE_COLLECTION_LIMIT).toBe(3);
  });
});

/**
 * The rule the switch guards, tested directly rather than through
 * `checkPlanLimits` — which would short-circuit while the constant is `false`
 * and leave every assertion below vacuous.
 */
describe("evaluatePlanLimits", () => {
  it("lets a Pro account past every cap without counting", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      isPro: true,
    } as never);
    vi.mocked(prisma.item.count).mockResolvedValue(9999 as never);

    expect(await evaluatePlanLimits(USER_ID, FILE)).toBeNull();
    expect(prisma.item.count).not.toHaveBeenCalled();
  });

  it("refuses a Pro-only type to a free account", async () => {
    const refusal = await evaluatePlanLimits(USER_ID, FILE);

    expect(refusal).toMatch(/Pro feature/);
    // The type rule answers before the count, so a refused type costs no query.
    expect(prisma.item.count).not.toHaveBeenCalled();
  });

  it("allows a free type while the account is under the cap", async () => {
    vi.mocked(prisma.item.count).mockResolvedValue(
      (FREE_ITEM_LIMIT - 1) as never,
    );

    expect(await evaluatePlanLimits(USER_ID, SNIPPET)).toBeNull();
  });

  it("refuses once the account is at the cap", async () => {
    // At, not over. A 50-item free account creating its 51st is the boundary
    // that decides whether the limit is "50 items" or "51".
    vi.mocked(prisma.item.count).mockResolvedValue(FREE_ITEM_LIMIT as never);

    expect(await evaluatePlanLimits(USER_ID, SNIPPET)).toMatch(
      /up to 50 items/,
    );
  });

  it("counts only this user's items", async () => {
    await evaluatePlanLimits(USER_ID, SNIPPET);

    expect(prisma.item.count).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER_ID },
      select: { isPro: true },
    });
  });

  it("does not refuse a session naming a deleted user", async () => {
    // The write that follows fails its own foreign key. Answering with a
    // billing sentence here would be a confusing lie about why.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never);

    expect(await evaluatePlanLimits(USER_ID, SNIPPET)).toBeNull();
  });

  it("treats a custom type as a free type", async () => {
    // `isProItemType` keys on the seeded `file`/`image` names, so a user's own
    // type is not accidentally Pro-gated by having an unfamiliar name.
    vi.mocked(prisma.item.count).mockResolvedValue(0 as never);

    expect(await evaluatePlanLimits(USER_ID, { name: "adr" })).toBeNull();
  });
});
