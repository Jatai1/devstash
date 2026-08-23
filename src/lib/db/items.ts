import type { ItemContentKind } from "@/generated/prisma/client";
import {
  ITEM_TYPE_DETAIL_SELECT,
  ITEM_TYPE_SELECT,
  type ItemTypeDetailSummary,
  type ItemTypeSummary,
} from "@/lib/db/item-types";
import { prisma } from "@/lib/prisma";

/** How many recent items the dashboard lists. */
export const RECENT_ITEMS_LIMIT = 10;

/** The parts of an `Item` an item card renders. */
export interface ItemSummary {
  id: string;
  title: string;
  description: string | null;
  isPinned: boolean;
  isFavorite: boolean;
  /** Drives the card's icon and border color. */
  type: ItemTypeSummary;
  /** Tag names, alphabetical. */
  tags: string[];
  updatedAt: Date;
}

/** The items a user pinned to the top of the dashboard, newest first. */
export function getPinnedItems(userId: string): Promise<ItemSummary[]> {
  return findItems({ userId, isPinned: true });
}

/**
 * The most recently updated items. Pinned items are left out because they
 * already have their own section directly above this one.
 */
export function getRecentItems(
  userId: string,
  limit: number = RECENT_ITEMS_LIMIT,
): Promise<ItemSummary[]> {
  return findItems({ userId, isPinned: false }, limit);
}

/**
 * Every item the user filed under one type, newest first, for `/items/[slug]`.
 *
 * Unlike the two dashboard lists this one is uncapped: it is the whole point of
 * the page, and the `@@index([itemTypeId])` on `Item` is what keeps the filter
 * cheap.
 */
export function getItemsByType(
  userId: string,
  itemTypeId: string,
): Promise<ItemSummary[]> {
  return findItems({ userId, itemTypeId });
}

/**
 * A collection an item was filed into, as the detail drawer lists it.
 *
 * Not exported: it is reachable through `ItemDetail["collections"]` and no
 * caller needs to name it separately.
 */
interface ItemCollectionSummary {
  id: string;
  name: string;
}

/**
 * One item in full, for the detail drawer.
 *
 * Extends the card's `ItemSummary` with the storage columns a card has no room
 * for. Which of `content` / `url` is populated follows `contentType`, not the
 * type's name — see `docs/item-types.md`.
 *
 * The `FILE` columns (`fileUrl`, `fileName`, `fileSize`) are deliberately left
 * out: nothing uploads yet, so selecting them would add a field no view reads.
 */
export interface ItemDetail extends ItemSummary {
  /**
   * Narrower than the card's: the drawer renders the body, and choosing between
   * the code editor and a textarea needs the type's `name`.
   */
  type: ItemTypeDetailSummary;
  /** Decides which of the columns below carries the item's payload. */
  contentType: ItemContentKind;
  /** Body of a `TEXT` item — snippet, prompt, command or note. */
  content: string | null;
  /** Syntax-highlighting hint for a code-like item, e.g. "typescript". */
  language: string | null;
  /** Target of a `URL` item. */
  url: string | null;
  /** The collections the item was filed into, alphabetical. */
  collections: ItemCollectionSummary[];
  createdAt: Date;
}

/**
 * An `ItemDetail` as it arrives over the wire from `GET /api/items/[id]`.
 *
 * JSON has no `Date`, so the two timestamps come back as ISO strings. Both
 * `formatShortDate` and `formatLongDate` already accept either form.
 *
 * Deriving it from `ItemDetail` keeps the *plain* fields in step automatically,
 * but the `Omit` list is hand-written: a new `Date` column added to `ItemDetail`
 * would be typed here as a `Date` while actually arriving as a string. Any such
 * column has to be added to the `Omit` below at the same time.
 */
export type SerializedItemDetail = Omit<
  ItemDetail,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

/**
 * One item in full, or `null` when this user has no such item.
 *
 * `userId` goes in the `where` rather than into a check after the fetch, so a
 * wrong owner is indistinguishable from a wrong id and both answer 404. A 403
 * would confirm the id exists, which is exactly what an id-guessing caller
 * wants to learn.
 */
export async function getItem(
  userId: string,
  id: string,
): Promise<ItemDetail | null> {
  const item = await prisma.item.findFirst({
    where: { id, userId },
    select: {
      id: true,
      title: true,
      description: true,
      isPinned: true,
      isFavorite: true,
      createdAt: true,
      updatedAt: true,
      contentType: true,
      content: true,
      language: true,
      url: true,
      itemType: { select: ITEM_TYPE_DETAIL_SELECT },
      tags: { select: { tag: { select: { name: true } } } },
      collections: {
        select: { collection: { select: { id: true, name: true } } },
      },
    },
  });

  if (!item) {
    return null;
  }

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    isPinned: item.isPinned,
    isFavorite: item.isFavorite,
    type: item.itemType,
    tags: sortTagNames(item.tags),
    updatedAt: item.updatedAt,
    contentType: item.contentType,
    content: item.content,
    language: item.language,
    url: item.url,
    // `ItemCollection` orders by nothing but `addedAt`, which would reshuffle
    // the badge row whenever an item is re-filed; name is stable.
    collections: item.collections
      .map(({ collection }) => collection)
      .sort((a, b) => a.name.localeCompare(b.name)),
    createdAt: item.createdAt,
  };
}

/** `ItemDetail` with its two timestamps already turned into ISO strings. */
export function serializeItemDetail(item: ItemDetail): SerializedItemDetail {
  return {
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

/**
 * What a mutation needs to know about an item before it touches one.
 *
 * `contentType` picks the schema an edit validates against, and the slug is what
 * both edit and delete revalidate — both of them properties of the stored row
 * rather than of the submission, which is the point: neither can be influenced
 * by what the client sends. Delete reads it only for the slug, and has to read
 * it before the row is gone.
 */
export interface ItemEditContext {
  contentType: ItemContentKind;
  /** The `/items/[slug]` page this item appears on. */
  typeSlug: string;
}

/** Scoped by `userId`, so another user's item reads as a missing one. */
export async function getItemEditContext(
  userId: string,
  id: string,
): Promise<ItemEditContext | null> {
  const item = await prisma.item.findFirst({
    where: { id, userId },
    select: { contentType: true, itemType: { select: { slug: true } } },
  });

  if (!item) {
    return null;
  }

  return { contentType: item.contentType, typeSlug: item.itemType.slug };
}

/** The columns an edit may write. Which of them apply follows `contentType`. */
export interface ItemUpdate {
  title: string;
  description?: string | null;
  content?: string | null;
  language?: string | null;
  url?: string | null;
}

/**
 * Applies an edit and returns the item as it now stands, or `null` when this
 * user has no such item.
 *
 * The write is scoped in the `where` rather than guarded by a preceding
 * ownership read: a wrong owner updates 0 rows, and that count *is* the
 * authorization result, with no window between checking and writing. The
 * `getItemEditContext` call the action makes first is for the schema and the
 * revalidation path — it is not what makes this safe.
 *
 * Tags are replaced wholesale rather than diffed. The join rows carry nothing
 * but the pair, so re-creating them loses no information, and a diff would be
 * three queries to save one. The `Tag` rows themselves are created on demand and
 * shared: `@@unique([userId, name])` is what makes the upsert idempotent per
 * user.
 *
 * All of it runs in one transaction, so a failure part-way cannot leave an item
 * holding its new title alongside its old tags.
 */
export async function updateItem(
  userId: string,
  id: string,
  fields: ItemUpdate,
  tagNames: string[],
): Promise<ItemDetail | null> {
  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.item.updateMany({
      where: { id, userId },
      data: fields,
    });

    if (count === 0) {
      return false;
    }

    await tx.itemTag.deleteMany({ where: { itemId: id } });

    // Sequentially rather than through `Promise.all`: an interactive
    // transaction runs on a single connection, and firing the upserts at it in
    // parallel is how they deadlock against each other.
    const tagIds: string[] = [];

    for (const name of tagNames) {
      const tag = await tx.tag.upsert({
        where: { userId_name: { userId, name } },
        create: { userId, name },
        update: {},
        select: { id: true },
      });

      tagIds.push(tag.id);
    }

    if (tagIds.length > 0) {
      await tx.itemTag.createMany({
        data: tagIds.map((tagId) => ({ itemId: id, tagId })),
      });
    }

    return true;
  });

  if (!updated) {
    return null;
  }

  // Re-read rather than assemble the response from what was written: the
  // caller renders type, tags and collections too, and only the row knows the
  // `updatedAt` Postgres just set.
  return getItem(userId, id);
}

/** The columns a create writes. Which of them apply follows the type's kind. */
export interface ItemCreate extends ItemUpdate {
  /** Already authorized by `getCreatableItemType` before it reaches here. */
  itemTypeId: string;
  /** Denormalized from `ItemType.contentKind`, never from the submission. */
  contentType: ItemContentKind;
}

/**
 * Writes a new item and its tags, and returns it as the drawer renders one.
 *
 * The shape mirrors `updateItem`: one transaction, tags upserted sequentially
 * on `@@unique([userId, name])` because an interactive transaction runs on a
 * single connection, then the joins created in one statement.
 *
 * There is no ownership check to make here — the row does not exist yet, so
 * `userId` is written rather than matched. What has to be verified is the
 * *type*, and that happens in `getCreatableItemType` before this is called;
 * passing an unvetted `itemTypeId` in would file the item under whatever it
 * names.
 */
export async function createItem(
  userId: string,
  fields: ItemCreate,
  tagNames: string[],
): Promise<ItemDetail | null> {
  const id = await prisma.$transaction(async (tx) => {
    const item = await tx.item.create({
      data: { ...fields, userId },
      select: { id: true },
    });

    const tagIds: string[] = [];

    for (const name of tagNames) {
      const tag = await tx.tag.upsert({
        where: { userId_name: { userId, name } },
        create: { userId, name },
        update: {},
        select: { id: true },
      });

      tagIds.push(tag.id);
    }

    if (tagIds.length > 0) {
      await tx.itemTag.createMany({
        data: tagIds.map((tagId) => ({ itemId: item.id, tagId })),
      });
    }

    return item.id;
  });

  // Re-read for the same reason `updateItem` does: the caller renders the type,
  // tags and collections too, and only the row knows the timestamps Postgres
  // just set.
  return getItem(userId, id);
}

/**
 * Deletes one item, reporting whether this user actually had it.
 *
 * Scoped in the `where` for the same reason `updateItem` is: a wrong owner
 * deletes 0 rows, and that count *is* the authorization result, with no window
 * between an ownership check and the write. A `findUnique` followed by
 * `delete({ where: { id } })` would have one.
 *
 * Nothing is cleaned up by hand. `ItemCollection.item` and `ItemTag.item` both
 * declare `onDelete: Cascade`, so the join rows go with the item in the same
 * statement. The `Tag` rows themselves are left alone deliberately — a tag
 * outliving its last item is the same orphan an edit leaves when it drops a
 * name, and a future tag picker would want exactly that history.
 */
export async function deleteItem(userId: string, id: string): Promise<boolean> {
  const { count } = await prisma.item.deleteMany({ where: { id, userId } });

  return count > 0;
}

export interface ItemStats {
  total: number;
  favorites: number;
}

/** Counters for the dashboard's item stats cards. */
export async function getItemStats(userId: string): Promise<ItemStats> {
  const [total, favorites] = await Promise.all([
    prisma.item.count({ where: { userId } }),
    prisma.item.count({ where: { userId, isFavorite: true } }),
  ]);

  return { total, favorites };
}

/** The item lists differ only in their filter, so they share one query. */
async function findItems(
  where: { userId: string; isPinned?: boolean; itemTypeId?: string },
  take?: number,
): Promise<ItemSummary[]> {
  const items = await prisma.item.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      title: true,
      description: true,
      isPinned: true,
      isFavorite: true,
      updatedAt: true,
      itemType: { select: ITEM_TYPE_SELECT },
      tags: { select: { tag: { select: { name: true } } } },
    },
  });

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    isPinned: item.isPinned,
    isFavorite: item.isFavorite,
    type: item.itemType,
    tags: sortTagNames(item.tags),
    updatedAt: item.updatedAt,
  }));
}

/**
 * `ItemTag` has no ordering of its own, so tag names are sorted by name to keep
 * the badge row stable between renders. Shared so a card and the drawer it
 * opens can never disagree about the order.
 */
function sortTagNames(tags: { tag: { name: string } }[]): string[] {
  return tags.map(({ tag }) => tag.name).sort((a, b) => a.localeCompare(b));
}
