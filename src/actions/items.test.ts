import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Three boundaries. `@/auth` is mocked because importing it for real pulls
 * NextAuth, the Prisma adapter and bcrypt into the test; `@/lib/db/items`
 * because the queries behind it have their own tests and Postgres is not what
 * this file is about; and `next/cache` because `revalidatePath` throws outside
 * a request — the paths it is called with are themselves worth asserting.
 *
 * Everything the action decides for itself — session handling, which schema the
 * stored `contentType` selects, what reaches the database and what is refused —
 * runs for real.
 */
vi.mock("@/auth", () => ({ auth: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/db/items", () => ({
  getItemEditContext: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  serializeItemDetail: vi.fn((item: { id: string }) => ({
    ...item,
    serialized: true,
  })),
}));

const { auth } = await import("@/auth");
const { revalidatePath } = await import("next/cache");
const db = await import("@/lib/db/items");
const { deleteItem, updateItem } = await import("@/actions/items");

const USER_ID = "user_1";
const ITEM_ID = "item_1";

/** A resolved session, as `auth()` returns one. */
function signedIn(id: string | null = USER_ID) {
  vi.mocked(auth).mockResolvedValue(
    (id ? { user: { id } } : null) as unknown as never,
  );
}

function storedAs(contentType: "TEXT" | "URL" | "FILE", typeSlug: string) {
  vi.mocked(db.getItemEditContext).mockResolvedValue({
    contentType,
    typeSlug,
  });
}

beforeEach(() => {
  signedIn();
  storedAs("TEXT", "snippets");
  vi.mocked(db.updateItem).mockResolvedValue({
    id: ITEM_ID,
  } as never);
  vi.mocked(db.deleteItem).mockResolvedValue(true);
});

describe("updateItem", () => {
  it("refuses when the session does not resolve", async () => {
    // A Server Action is a public endpoint. Being rendered behind the proxy is
    // not authorization, so the action re-derives the user itself.
    signedIn(null);

    expect(await updateItem(ITEM_ID, { title: "Renamed" })).toEqual({
      error: "Your session has expired. Sign in again.",
    });

    expect(db.getItemEditContext).not.toHaveBeenCalled();
    expect(db.updateItem).not.toHaveBeenCalled();
  });

  /**
   * The id comes from the client, so the lookup is scoped to the session's user
   * — never to an owner named in the payload.
   */
  it("looks the item up as the signed-in user", async () => {
    await updateItem(ITEM_ID, { title: "Renamed" });

    expect(db.getItemEditContext).toHaveBeenCalledWith(USER_ID, ITEM_ID);
  });

  it("answers the same way for a missing item and someone else's", async () => {
    // Both read as `null` here, and distinguishing them would confirm that an
    // id exists — which is what an id-guessing caller wants to learn.
    vi.mocked(db.getItemEditContext).mockResolvedValue(null);

    expect(await updateItem(ITEM_ID, { title: "Renamed" })).toEqual({
      error: "That item no longer exists.",
    });

    expect(db.updateItem).not.toHaveBeenCalled();
  });

  it("returns field errors and writes nothing when validation fails", async () => {
    const state = await updateItem(ITEM_ID, { title: "   " });

    expect(state.fieldErrors?.title).toEqual(["Title is required"]);
    expect(state.item).toBeUndefined();
    expect(db.updateItem).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("passes the parsed fields and tags through separately", async () => {
    await updateItem(ITEM_ID, {
      title: "  Renamed  ",
      description: "",
      content: "const x = 1;",
      language: "typescript",
      tags: [" react ", "react", ""],
    });

    expect(db.updateItem).toHaveBeenCalledWith(
      USER_ID,
      ITEM_ID,
      {
        title: "Renamed",
        description: null,
        content: "const x = 1;",
        language: "typescript",
      },
      ["react"],
    );
  });

  /**
   * The schema follows the row, not the request. A link item's payload is a
   * `url`, and `content` is not a field it has — so this cannot be used to write
   * a body onto a type that does not store one.
   */
  it("chooses the schema from the stored content kind", async () => {
    storedAs("URL", "links");

    await updateItem(ITEM_ID, {
      title: "Docs",
      url: "https://nextjs.org/docs",
      content: "smuggled",
    });

    expect(db.updateItem).toHaveBeenCalledWith(
      USER_ID,
      ITEM_ID,
      { title: "Docs", description: null, url: "https://nextjs.org/docs" },
      [],
    );
  });

  it("refuses a javascript: URL on a link", async () => {
    // The drawer renders this value into an `<a href>`, so accepting it would
    // store an XSS payload.
    storedAs("URL", "links");

    const state = await updateItem(ITEM_ID, {
      title: "Docs",
      url: "javascript:alert(1)",
    });

    expect(state.fieldErrors?.url).toBeDefined();
    expect(db.updateItem).not.toHaveBeenCalled();
  });

  it("reports a row the write no longer matched", async () => {
    // Reachable: the item can be deleted between the lookup and the write, and
    // the update's count is the authorization result either way.
    vi.mocked(db.updateItem).mockResolvedValue(null);

    expect(await updateItem(ITEM_ID, { title: "Renamed" })).toEqual({
      error: "That item no longer exists.",
    });

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("leaves the item alone and says so when the transaction fails", async () => {
    vi.mocked(db.updateItem).mockRejectedValue(new Error("connection"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await updateItem(ITEM_ID, { title: "Renamed" });

    expect(state).toEqual({
      error: "Could not save your changes just now. Try again.",
    });

    // An error boundary would replace the drawer and lose what was typed.
    expect(logged).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the saved item, serialized, with a success message", async () => {
    const state = await updateItem(ITEM_ID, { title: "Renamed" });

    expect(state.message).toBe("Changes saved.");
    expect(state.item).toMatchObject({ id: ITEM_ID, serialized: true });
    expect(state.error).toBeUndefined();
  });

  /**
   * Both pages are `force-dynamic`, so this is about the client-side Router
   * Cache: without it, navigating back to a page already visited this session
   * would serve the pre-edit card.
   */
  it("revalidates the dashboard and the item's own type page", async () => {
    storedAs("URL", "links");

    await updateItem(ITEM_ID, { title: "Docs", url: "https://a.co" });

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/items/links");
  });
});

describe("deleteItem", () => {
  it("refuses when the session does not resolve", async () => {
    // A Server Action is a public endpoint, so the action re-derives the user
    // rather than trusting the page that rendered the button.
    signedIn(null);

    expect(await deleteItem(ITEM_ID)).toEqual({
      error: "Your session has expired. Sign in again.",
    });

    expect(db.getItemEditContext).not.toHaveBeenCalled();
    expect(db.deleteItem).not.toHaveBeenCalled();
  });

  /** The id comes from the client, so both calls carry the session's user. */
  it("scopes both the lookup and the delete to the signed-in user", async () => {
    await deleteItem(ITEM_ID);

    expect(db.getItemEditContext).toHaveBeenCalledWith(USER_ID, ITEM_ID);
    expect(db.deleteItem).toHaveBeenCalledWith(USER_ID, ITEM_ID);
  });

  /**
   * The lookup runs first only because the revalidation path lives on the row
   * and cannot be read once it is gone — it is not what makes the delete safe.
   */
  it("reads the type slug before the row is deleted", async () => {
    const order: string[] = [];

    vi.mocked(db.getItemEditContext).mockImplementation(async () => {
      order.push("read");

      return { contentType: "TEXT", typeSlug: "snippets" };
    });
    vi.mocked(db.deleteItem).mockImplementation(async () => {
      order.push("delete");

      return true;
    });

    await deleteItem(ITEM_ID);

    expect(order).toEqual(["read", "delete"]);
  });

  it("answers the same for a missing item and someone else's item", async () => {
    // Distinguishing them would confirm that an id exists, which is what an
    // id-guessing caller wants to learn.
    vi.mocked(db.getItemEditContext).mockResolvedValue(null);

    expect(await deleteItem(ITEM_ID)).toEqual({
      error: "That item no longer exists.",
    });

    expect(db.deleteItem).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports not-found when the row goes between the read and the write", async () => {
    // Rare, but the count is the authorization result and it says this user
    // has no such item.
    vi.mocked(db.deleteItem).mockResolvedValue(false);

    expect(await deleteItem(ITEM_ID)).toEqual({
      error: "That item no longer exists.",
    });

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a failed delete rather than throwing", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(db.deleteItem).mockRejectedValue(new Error("connection lost"));

    expect(await deleteItem(ITEM_ID)).toEqual({
      error: "Could not delete this item just now. Try again.",
    });

    // An error boundary would replace the drawer the dialog is sitting in.
    expect(logged).toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("confirms the delete with a message and no error", async () => {
    expect(await deleteItem(ITEM_ID)).toEqual({ message: "Item deleted." });
  });

  it("revalidates the dashboard and the item's own type page", async () => {
    storedAs("URL", "links");

    await deleteItem(ITEM_ID);

    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledWith("/items/links");
  });
});
