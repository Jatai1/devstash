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
    // `ItemTag` has no ordering of its own, so sort by name to keep the badge
    // row stable between renders.
    tags: item.tags
      .map(({ tag }) => tag.name)
      .sort((a, b) => a.localeCompare(b)),
    updatedAt: item.updatedAt,
  }));
}
