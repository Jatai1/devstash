"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import {
  getItemEditContext,
  serializeItemDetail,
  updateItem as updateItemRow,
  type SerializedItemDetail,
} from "@/lib/db/items";
import { itemUpdateSchemaFor, type ItemUpdateField } from "@/lib/item-schemas";

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
  fieldErrors?: Partial<Record<ItemUpdateField, string[]>>;
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

  const parsed = itemUpdateSchemaFor(context.contentType).safeParse(input);

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
