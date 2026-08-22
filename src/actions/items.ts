"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { getCreatableItemType } from "@/lib/db/item-types";
import {
  createItem as createItemRow,
  deleteItem as deleteItemRow,
  getItemEditContext,
  serializeItemDetail,
  updateItem as updateItemRow,
  type SerializedItemDetail,
} from "@/lib/db/items";
import {
  itemSchemaFor,
  type ItemCreateField,
  type ItemField,
} from "@/lib/item-schemas";
import { checkPlanLimits } from "@/lib/plan-limits";

/**
 * What every action here says when the session does not resolve to a row.
 *
 * A Server Action is an endpoint of its own, so it re-derives the user rather
 * than trusting that the page holding the form was behind the proxy. See
 * `src/actions/profile.ts`, which carries the same pair for the same reason.
 */
const NO_SESSION = "Your session has expired. Sign in again.";

/**
 * The answer for both a missing item and someone else's item.
 *
 * Deliberately one message: distinguishing them would confirm that an id exists,
 * which is exactly what an id-guessing caller wants to learn. `GET
 * /api/items/[id]` answers 404 for both for the same reason.
 */
const NOT_FOUND = "That item no longer exists.";

/** The signed-in user's id, or null when the session no longer resolves. */
async function currentUserId(): Promise<string | null> {
  const session = await auth();

  return session?.user?.id ?? null;
}

/** What the create dialog submits. */
export interface CreateItemInput {
  itemTypeId: string;
  title: string;
  description?: string | null;
  tags?: string[];
  content?: string | null;
  language?: string | null;
  url?: string | null;
}

export interface CreateItemState {
  /** Whole-form failure, rendered above the fields. */
  error?: string;
  /** Field-keyed messages, so the form can mark the offending input. */
  fieldErrors?: Partial<Record<ItemCreateField, string[]>>;
  /** Shown on success. */
  message?: string;
  /** The created item, so the caller can render it without a second request. */
  item?: SerializedItemDetail;
  /**
   * Changes on every success, so a form that clears itself can tell two
   * consecutive creates apart. `message` is the same string each time, which
   * React compares equal — the bug `ChangePasswordState` documents.
   */
  succeededAt?: number;
}

/**
 * Creates one item for the signed-in user.
 *
 * The order here is the whole security story. The **type is resolved and
 * authorized first**, because it decides two things that must not come from the
 * client: which schema validates the payload, and the `contentType` written to
 * the row. `Item.itemTypeId` is a plain unscoped FK, so a submission naming
 * another user's custom type would otherwise be filed under it — the hole
 * `docs/item-crud-architecture.md` §5 flags, and the one the drawer's edit mode
 * sidestepped by making the type non-editable.
 *
 * Fields belonging to another kind are dropped by the schema rather than
 * checked for here, so a `url` sent with a snippet never reaches the database.
 */
export async function createItem(
  input: CreateItemInput,
): Promise<CreateItemState> {
  const userId = await currentUserId();

  if (!userId) {
    return { error: NO_SESSION };
  }

  const itemType = input.itemTypeId
    ? await getCreatableItemType(userId, input.itemTypeId)
    : null;

  if (!itemType) {
    // One message for "no type chosen", "no such type" and "someone else's
    // type". The last two are the same refusal a wrong owner gets anywhere
    // else here, and naming which it was would confirm the id exists.
    return { fieldErrors: { itemTypeId: ["Choose an item type"] } };
  }

  // After the type is resolved, because the answer depends on which type it
  // is, and before the payload is parsed, because a refusal is not about the
  // fields. Unenforced during development — see `PLAN_LIMITS_ENFORCED`.
  const refusal = await checkPlanLimits(userId, itemType);

  if (refusal) {
    return { error: refusal };
  }

  const parsed = itemSchemaFor(itemType.contentKind).safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { tags, ...fields } = parsed.data;

  let item;

  try {
    item = await createItemRow(
      userId,
      {
        ...fields,
        itemTypeId: itemType.id,
        contentType: itemType.contentKind,
      },
      tags,
    );
  } catch (error) {
    // Reported rather than thrown: an error boundary would replace the dialog
    // and lose everything the user had typed.
    console.error("Item create failed", error);

    return { error: "Could not create this item just now. Try again." };
  }

  if (!item) {
    return { error: "Could not create this item just now. Try again." };
  }

  // Both pages are `force-dynamic`, so this is the client-side Router Cache:
  // without it, a page already visited this session would not show the new
  // item.
  revalidatePath("/dashboard");
  revalidatePath(`/items/${itemType.slug}`);

  return {
    message: "Item created.",
    item: serializeItemDetail(item),
    succeededAt: Date.now(),
  };
}

/**
 * What the drawer's edit form submits.
 *
 * Typed for the caller's benefit only — types are erased at runtime and this is
 * a public endpoint, so everything below re-validates it as `unknown` would be.
 * Which fields apply depends on the item's `contentType`; the rest are dropped.
 */
export interface UpdateItemInput {
  title: string;
  description?: string | null;
  tags?: string[];
  content?: string | null;
  language?: string | null;
  url?: string | null;
}

export interface UpdateItemState {
  /** Whole-form failure, rendered above the fields. */
  error?: string;
  /** Field-keyed messages, so the form can mark the offending input. */
  fieldErrors?: Partial<Record<ItemField, string[]>>;
  /** Shown on success. */
  message?: string;
  /**
   * The saved item, so the drawer can return to its view mode without a second
   * request. Only ever set alongside `message`.
   */
  item?: SerializedItemDetail;
}

/**
 * Saves an edit to one item the signed-in user owns.
 *
 * Not `useActionState`-shaped: the drawer edits with controlled inputs rather
 * than a submitted `FormData`, so the id is an argument and the fields arrive as
 * an object. The *return* is the project's usual flat state — `error`,
 * `fieldErrors`, `message` — because `context/coding-standards.md` rejects a
 * `{ success, data, error }` wrapper, and a form that had to unwrap a level
 * before rendering an error would gain nothing from it.
 *
 * The item's **type is not editable**, which is what keeps this simple: no
 * `itemTypeId` arrives from the client, so there is nothing here that could file
 * an item under another user's custom type.
 */
export async function updateItem(
  itemId: string,
  input: UpdateItemInput,
): Promise<UpdateItemState> {
  const userId = await currentUserId();

  if (!userId) {
    return { error: NO_SESSION };
  }

  // Read before validating, because the stored `contentType` is what decides
  // which fields are even legal. This is not the ownership check — the write
  // below scopes itself — it just means an unknown item fails here rather than
  // after a pointless parse.
  const context = await getItemEditContext(userId, itemId);

  if (!context) {
    return { error: NOT_FOUND };
  }

  const parsed = itemSchemaFor(context.contentType).safeParse(input);

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { tags, ...fields } = parsed.data;

  let item;

  try {
    item = await updateItemRow(userId, itemId, fields, tags);
  } catch (error) {
    // The transaction is atomic, so a failure here leaves the item exactly as
    // it was. Reported rather than thrown: an error boundary would replace the
    // drawer and lose everything the user had typed.
    console.error("Item update failed", error);

    return { error: "Could not save your changes just now. Try again." };
  }

  // Deleted between the read above and the write — rare, but the count is the
  // authorization result and it says this user has no such item.
  if (!item) {
    return { error: NOT_FOUND };
  }

  // Both pages are `force-dynamic`, so this is not about the Full Route Cache.
  // It is the client-side Router Cache: without it, navigating back to a page
  // already visited this session would serve the pre-edit card.
  revalidatePath("/dashboard");
  revalidatePath(`/items/${context.typeSlug}`);

  return {
    message: "Changes saved.",
    item: serializeItemDetail(item),
  };
}

export interface DeleteItemState {
  /** Whole-form failure, rendered inside the confirmation dialog. */
  error?: string;
  /** Shown on success. */
  message?: string;
}

/**
 * Permanently deletes one item the signed-in user owns.
 *
 * There is nothing to validate — the only input is an id, and the `where` on
 * the delete is what decides whether it names anything this caller may touch —
 * so the state has no `fieldErrors`. It keeps the project's flat shape all the
 * same, since the dialog renders `error` exactly as every other form does.
 *
 * Hard delete, matching the assumption in `docs/item-crud-architecture.md`:
 * `Item` has no `deletedAt` and nothing in the app filters on one, so a soft
 * delete would be a column every existing query would have to learn about.
 */
export async function deleteItem(itemId: string): Promise<DeleteItemState> {
  const userId = await currentUserId();

  if (!userId) {
    return { error: NO_SESSION };
  }

  // Read the slug *before* the row is gone — it is the `/items/[slug]` page
  // that has to be revalidated, and only the item knows which one that is.
  // Like the same call in `updateItem`, this is not the ownership check; the
  // delete below scopes itself.
  const context = await getItemEditContext(userId, itemId);

  if (!context) {
    return { error: NOT_FOUND };
  }

  let deleted: boolean;

  try {
    deleted = await deleteItemRow(userId, itemId);
  } catch (error) {
    // Reported rather than thrown: an error boundary would replace the drawer
    // the dialog is sitting in, which is a worse answer than a sentence.
    console.error("Item delete failed", error);

    return { error: "Could not delete this item just now. Try again." };
  }

  // Deleted between the read above and the write. Rare, but the count is the
  // authorization result and it says this user has no such item.
  if (!deleted) {
    return { error: NOT_FOUND };
  }

  // Both pages are `force-dynamic`, so this is the client-side Router Cache
  // rather than the Full Route Cache: without it, navigating back to a page
  // already visited this session would still show the deleted card.
  revalidatePath("/dashboard");
  revalidatePath(`/items/${context.typeSlug}`);

  return { message: "Item deleted." };
}
