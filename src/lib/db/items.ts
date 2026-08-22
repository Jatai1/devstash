import type { ItemContentKind } from "@/generated/prisma/client";
import { ITEM_TYPE_SELECT, type ItemTypeSummary } from "@/lib/db/item-types";
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
      itemType: { select: ITEM_TYPE_SELECT },
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
