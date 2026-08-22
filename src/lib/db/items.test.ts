import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `@/lib/prisma` is the only boundary here: these tests are about what these
 * functions ask the database for and what they make of the answer, not about
 * Postgres. `npm run test:db` remains the check that the real connection works.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    item: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    tag: { upsert: vi.fn() },
    itemTag: { deleteMany: vi.fn(), createMany: vi.fn() },
  },
}));

const { prisma } = await import("@/lib/prisma");
const {
  createItem,
  deleteItem,
  getItem,
  getItemEditContext,
  serializeItemDetail,
  updateItem,
} = await import("@/lib/db/items");

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

describe("getItemEditContext", () => {
  beforeEach(() => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue({
      contentType: "TEXT",
      itemType: { slug: "snippets" },
    } as never);
  });

  /**
   * Both values an edit needs are properties of the stored row rather than of
   * the submission — which is the point: neither the schema that will be
   * applied nor the path that will be revalidated can be steered by the client.
   */
  it("returns the stored content kind and the type's slug", async () => {
    await expect(getItemEditContext(USER_ID, ITEM_ID)).resolves.toEqual({
      contentType: "TEXT",
      typeSlug: "snippets",
    });
  });

  it("scopes the lookup by user, so another user's item reads as missing", async () => {
    vi.mocked(prisma.item.findFirst).mockResolvedValue(null);

    await expect(
      getItemEditContext("someone_else", ITEM_ID),
    ).resolves.toBeNull();

    expect(prisma.item.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ITEM_ID, userId: "someone_else" },
      }),
    );
  });
});

describe("createItem", () => {
  const FIELDS = {
    title: "useAuth",
    description: null,
    itemTypeId: "type_snippet",
    contentType: "TEXT" as const,
  };

  beforeEach(() => {
    vi.mocked(prisma.$transaction).mockImplementation((run) =>
      (run as (tx: typeof prisma) => Promise<unknown>)(prisma),
    );

    vi.mocked(prisma.item.create).mockResolvedValue({ id: ITEM_ID } as never);
    vi.mocked(prisma.tag.upsert).mockImplementation(
      (async ({ create }: { create: { name: string } }) => ({
        id: `tag_${create.name}`,
      })) as never,
    );
    resolvesTo(row());
  });

  /**
   * There is no ownership check to make — the row does not exist yet — so
   * `userId` is written rather than matched. The type it is filed under was
   * authorized by `getCreatableItemType` before this was called.
   */
  it("writes the owner onto the new row", async () => {
    await createItem(USER_ID, FIELDS, []);

    expect(prisma.item.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { ...FIELDS, userId: USER_ID },
      }),
    );
  });

  it("upserts each tag for this user and joins them to the item", async () => {
    await createItem(USER_ID, FIELDS, ["react", "hooks"]);

    // `@@unique([userId, name])` is what makes the upsert idempotent per user:
    // one person's "react" is never another's.
    expect(prisma.tag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_name: { userId: USER_ID, name: "react" } },
        create: { userId: USER_ID, name: "react" },
        update: {},
      }),
    );

    expect(prisma.itemTag.createMany).toHaveBeenCalledWith({
      data: [
        { itemId: ITEM_ID, tagId: "tag_react" },
        { itemId: ITEM_ID, tagId: "tag_hooks" },
      ],
    });
  });

  it("issues no join statement when there are no tags", async () => {
    await createItem(USER_ID, FIELDS, []);

    // `createMany` with an empty array is a statement that does nothing.
    expect(prisma.itemTag.createMany).not.toHaveBeenCalled();
  });

  it("does all of it in one transaction", async () => {
    await createItem(USER_ID, FIELDS, ["react"]);

    // Otherwise a failure part-way could leave an item with no tags, which is
    // indistinguishable from one deliberately created without any.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("re-reads the item as the owner, so the caller gets the stored timestamps", async () => {
    const item = await createItem(USER_ID, FIELDS, []);

    expect(prisma.item.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ITEM_ID, userId: USER_ID } }),
    );
    expect(item?.id).toBe(ITEM_ID);
  });
});

describe("updateItem", () => {
  const FIELDS = { title: "Renamed", description: null };

  beforeEach(() => {
    // The callback runs against the same mock, so assertions below read the
    // statements the transaction issued.
    vi.mocked(prisma.$transaction).mockImplementation((run) =>
      (run as (tx: typeof prisma) => Promise<unknown>)(prisma),
    );

    vi.mocked(prisma.item.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.tag.upsert).mockImplementation(
      (async ({ create }: { create: { name: string } }) => ({
        id: `tag_${create.name}`,
      })) as never,
    );
    resolvesTo(row({ title: "Renamed" }));
  });

  /**
   * The security decision. A wrong owner updates 0 rows and that count *is* the
   * authorization result — there is no window between checking and writing,
   * which a `findUnique` followed by an `update` would have.
   */
  it("scopes the write itself rather than checking ownership first", async () => {
    await updateItem(USER_ID, ITEM_ID, FIELDS, []);

    expect(prisma.item.updateMany).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: USER_ID },
      data: FIELDS,
    });
  });

  it("returns null and touches no tags when the write matches nothing", async () => {
    vi.mocked(prisma.item.updateMany).mockResolvedValue({ count: 0 } as never);

    await expect(
      updateItem("someone_else", ITEM_ID, FIELDS, ["react"]),
    ).resolves.toBeNull();

    expect(prisma.itemTag.deleteMany).not.toHaveBeenCalled();
    expect(prisma.tag.upsert).not.toHaveBeenCalled();
  });

  it("replaces the item's tags, creating the ones that do not exist", async () => {
    await updateItem(USER_ID, ITEM_ID, FIELDS, ["react", "hooks"]);

    expect(prisma.itemTag.deleteMany).toHaveBeenCalledWith({
      where: { itemId: ITEM_ID },
    });

    // `@@unique([userId, name])` is what makes the upsert idempotent per user:
    // one person's "react" is never another's.
    expect(prisma.tag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_name: { userId: USER_ID, name: "react" } },
        create: { userId: USER_ID, name: "react" },
        update: {},
      }),
    );

    expect(prisma.itemTag.createMany).toHaveBeenCalledWith({
      data: [
        { itemId: ITEM_ID, tagId: "tag_react" },
        { itemId: ITEM_ID, tagId: "tag_hooks" },
      ],
    });
  });

  it("clears every tag when the list is empty", async () => {
    await updateItem(USER_ID, ITEM_ID, FIELDS, []);

    expect(prisma.itemTag.deleteMany).toHaveBeenCalledWith({
      where: { itemId: ITEM_ID },
    });

    // `createMany` with an empty array is a statement that does nothing.
    expect(prisma.itemTag.createMany).not.toHaveBeenCalled();
  });

  it("does all of it in one transaction", async () => {
    await updateItem(USER_ID, ITEM_ID, FIELDS, ["react"]);

    // Otherwise a failure part-way could leave an item holding its new title
    // alongside its old tags.
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("re-reads the item, so the caller gets the timestamp Postgres just set", async () => {
    const item = await updateItem(USER_ID, ITEM_ID, FIELDS, []);

    expect(prisma.item.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ITEM_ID, userId: USER_ID } }),
    );
    expect(item?.title).toBe("Renamed");
  });
});

describe("deleteItem", () => {
  it("scopes the delete to the owner in the `where`", async () => {
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 1 } as never);

    await deleteItem(USER_ID, ITEM_ID);

    // Both keys in one statement. A `findFirst` ownership check followed by a
    // `delete({ where: { id } })` would leave a window between them; here the
    // count *is* the authorization result.
    expect(prisma.item.deleteMany).toHaveBeenCalledWith({
      where: { id: ITEM_ID, userId: USER_ID },
    });
  });

  it("reports true when a row was removed", async () => {
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 1 } as never);

    expect(await deleteItem(USER_ID, ITEM_ID)).toBe(true);
  });

  it("reports false when the item is missing or belongs to someone else", async () => {
    // The two cases are indistinguishable on purpose — a caller guessing ids
    // learns nothing about which ones exist.
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 0 } as never);

    expect(await deleteItem(USER_ID, ITEM_ID)).toBe(false);
  });

  it("leaves the join rows to the database", async () => {
    vi.mocked(prisma.item.deleteMany).mockResolvedValue({ count: 1 } as never);

    await deleteItem(USER_ID, ITEM_ID);

    // `ItemCollection.item` and `ItemTag.item` both declare `onDelete: Cascade`,
    // so cleaning up by hand would be a second statement doing what the first
    // already did — and one more chance to leave the two out of step.
    expect(prisma.itemTag.deleteMany).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("serializeItemDetail", () => {
  it("turns both timestamps into ISO strings and leaves the rest alone", async () => {
    const item = await getItem(USER_ID, ITEM_ID);
    const serialized = serializeItemDetail(item!);

    expect(serialized.createdAt).toBe("2026-01-15T00:00:00.000Z");
    expect(serialized.updatedAt).toBe("2026-02-20T00:00:00.000Z");
    expect(serialized.title).toBe(item!.title);
    expect(serialized.type).toEqual(item!.type);
  });
});
