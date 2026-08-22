import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `@/lib/prisma` is the only boundary here: these tests are about what
 * `getItem` asks the database for and what it makes of the answer, not about
 * Postgres. `npm run test:db` remains the check that the real connection works.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    item: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  },
}));

const { prisma } = await import("@/lib/prisma");
const { getItem } = await import("@/lib/db/items");

const USER_ID = "user_1";
const ITEM_ID = "item_1";

const TYPE = {
  id: "type_snippet",
  label: "Snippets",
  icon: "Code",
  color: "#3b82f6",
};

/** A row shaped the way the `select` in `getItem` returns one. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    title: "useAuth Hook",
    description: "Custom authentication hook",
    isPinned: true,
    isFavorite: true,
    createdAt: new Date("2026-01-15T00:00:00.000Z"),
    updatedAt: new Date("2026-02-20T00:00:00.000Z"),
    contentType: "TEXT",
    content: "export function useAuth() {}",
    language: "typescript",
    url: null,
    itemType: TYPE,
    tags: [],
    collections: [],
    ...overrides,
  };
}

function resolvesTo(value: unknown) {
  vi.mocked(prisma.item.findFirst).mockResolvedValue(value as never);
}

describe("getItem", () => {
  beforeEach(() => {
    resolvesTo(row());
  });

  it("scopes the query by user as well as id", async () => {
    await getItem(USER_ID, ITEM_ID);

    expect(prisma.item.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ITEM_ID, userId: USER_ID } }),
    );
  });

  it("returns null when the user has no such item", async () => {
    resolvesTo(null);

    await expect(getItem(USER_ID, ITEM_ID)).resolves.toBeNull();
  });

  /**
   * The security decision this function exists to make. A wrong owner has to be
   * indistinguishable from a wrong id, because the route above turns both into
   * a 404 — a 403 for the first would confirm the id exists, which is what an
   * id-guessing caller wants to learn. Putting `userId` in the `where` is what
   * makes the two identical, so the test pins the filter rather than the
   * caller's handling of it.
   */
  it("cannot return another user's item", async () => {
    // A `where` carrying both columns matches nothing when the owner differs,
    // which is the `null` above rather than a row this code has to reject.
    resolvesTo(null);

    const item = await getItem("someone_else", ITEM_ID);

    expect(item).toBeNull();
    expect(prisma.item.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM_ID, userId: "someone_else" },
      }),
    );
  });

  it("flattens the item type onto `type`", async () => {
    const item = await getItem(USER_ID, ITEM_ID);

    expect(item?.type).toEqual(TYPE);
  });

  it("sorts tag names alphabetically", async () => {
    resolvesTo(
      row({
        tags: [
          { tag: { name: "react" } },
          { tag: { name: "auth" } },
          { tag: { name: "hooks" } },
        ],
      }),
    );

    const item = await getItem(USER_ID, ITEM_ID);

    expect(item?.tags).toEqual(["auth", "hooks", "react"]);
  });

  it("sorts collections by name, not by when the item was filed", async () => {
    resolvesTo(
      row({
        collections: [
          { collection: { id: "c2", name: "Terminal Commands" } },
          { collection: { id: "c1", name: "React Patterns" } },
        ],
      }),
    );

    const item = await getItem(USER_ID, ITEM_ID);

    expect(item?.collections).toEqual([
      { id: "c1", name: "React Patterns" },
      { id: "c2", name: "Terminal Commands" },
    ]);
  });

  it("carries the payload columns a card leaves out", async () => {
    const item = await getItem(USER_ID, ITEM_ID);

    expect(item).toMatchObject({
      contentType: "TEXT",
      content: "export function useAuth() {}",
      language: "typescript",
      url: null,
    });
  });

  /**
   * Nothing uploads yet, so selecting `fileUrl`/`fileName`/`fileSize` would add
   * fields no view reads — the dead-export shape two earlier reviews caught.
   */
  it("does not select the file columns", async () => {
    await getItem(USER_ID, ITEM_ID);

    const { select } = vi.mocked(prisma.item.findFirst).mock.calls[0][0]!;

    expect(select).not.toHaveProperty("fileUrl");
    expect(select).not.toHaveProperty("fileName");
    expect(select).not.toHaveProperty("fileSize");
  });

  it("keeps both timestamps, since the drawer shows created and updated", async () => {
    const item = await getItem(USER_ID, ITEM_ID);

    expect(item?.createdAt).toEqual(new Date("2026-01-15T00:00:00.000Z"));
    expect(item?.updatedAt).toEqual(new Date("2026-02-20T00:00:00.000Z"));
  });

  it("passes a URL item's target through", async () => {
    resolvesTo(
      row({
        contentType: "URL",
        content: null,
        language: null,
        url: "https://nextjs.org/docs",
      }),
    );

    const item = await getItem(USER_ID, ITEM_ID);

    expect(item).toMatchObject({
      contentType: "URL",
      url: "https://nextjs.org/docs",
      content: null,
    });
  });
});
