import { Prisma } from "@/generated/prisma/client";
import { ITEM_TYPE_SELECT, type ItemTypeSummary } from "@/lib/db/item-types";
import { prisma } from "@/lib/prisma";

/** How many collections the dashboard grid shows. */
export const RECENT_COLLECTIONS_LIMIT = 6;

/** How many non-favorite collections the sidebar's "Recent" list shows. */
export const SIDEBAR_RECENT_COLLECTIONS_LIMIT = 5;

export interface CollectionSummary {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  /** Items in the collection, counted from `ItemCollection`. */
  itemCount: number;
  /**
   * The type most of the collection's items use, which drives the card's border
   * color. Falls back to `Collection.defaultType` for an empty collection, and
   * is null only when that is unset too.
   */
  dominantType: ItemTypeSummary | null;
  /** Every type the collection holds, most-used first. */
  types: ItemTypeSummary[];
  updatedAt: Date;
}

/**
 * The collections a user most recently touched, newest first.
 *
 * The per-collection type breakdown is computed here rather than read off a
 * column: `Collection.defaultTypeId` is only a suggestion for new items, so it
 * can disagree with what the collection actually holds.
 */
export function getRecentCollections(
  userId: string,
  limit: number = RECENT_COLLECTIONS_LIMIT,
): Promise<CollectionSummary[]> {
  return findCollections({ userId }, limit);
}

/** The two lists the sidebar's "Collections" group renders. */
export interface SidebarCollections {
  /** Every collection the user starred, newest first. */
  favorites: CollectionSummary[];
  /** The most recently updated of everything else. */
  recent: CollectionSummary[];
}

/**
 * Collections for the sidebar, split into favorites and recents.
 *
 * The `isFavorite: false` filter on the second query is what keeps a starred
 * collection from appearing twice in the sidebar.
 */
export async function getSidebarCollections(
  userId: string,
  recentLimit: number = SIDEBAR_RECENT_COLLECTIONS_LIMIT,
): Promise<SidebarCollections> {
  const [favorites, recent] = await Promise.all([
    findCollections({ userId, isFavorite: true }),
    findCollections({ userId, isFavorite: false }, recentLimit),
  ]);

  return { favorites, recent };
}

export interface CollectionStats {
  total: number;
  favorites: number;
}

/** Counters for the dashboard's collection stats cards. */
export async function getCollectionStats(
  userId: string,
): Promise<CollectionStats> {
  const [total, favorites] = await Promise.all([
    prisma.collection.count({ where: { userId } }),
    prisma.collection.count({ where: { userId, isFavorite: true } }),
  ]);

  return { total, favorites };
}

/** Every collection list differs only in its filter, so they share one query. */
async function findCollections(
  where: { userId: string; isFavorite?: boolean },
  take?: number,
): Promise<CollectionSummary[]> {
  const collections = await prisma.collection.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take,
    select: {
      id: true,
      name: true,
      description: true,
      isFavorite: true,
      updatedAt: true,
      defaultType: { select: ITEM_TYPE_SELECT },
    },
  });

  if (collections.length === 0) {
    return [];
  }

  const breakdown = await countTypesByCollection(
    collections.map((collection) => collection.id),
  );

  return collections.map((collection) => {
    const types = breakdown.get(collection.id) ?? [];

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isFavorite: collection.isFavorite,
      itemCount: types.reduce((total, entry) => total + entry.count, 0),
      dominantType: types[0]?.type ?? collection.defaultType,
      types: types.map((entry) => entry.type),
      updatedAt: collection.updatedAt,
    };
  });
}

/** One type a collection holds, with how many of its items use that type. */
interface TypeUse {
  type: ItemTypeSummary;
  count: number;
}

/**
 * How many items of each type every listed collection holds, most-used first.
 *
 * This aggregates in the database rather than pulling the collections' items
 * through the ORM: the counts are all the card needs, so fetching one row per
 * item would make the payload scale with collection size for no gain. What
 * comes back is one row per collection/type pair instead — bounded by how many
 * item types exist, not by how many items were filed.
 */
async function countTypesByCollection(
  collectionIds: string[],
): Promise<Map<string, TypeUse[]>> {
  const rows = await prisma.$queryRaw<
    { collectionId: string; itemTypeId: string; count: number }[]
  >`
    SELECT ic."collectionId", i."itemTypeId", COUNT(*)::int AS count
    FROM "ItemCollection" ic
    JOIN "Item" i ON i."id" = ic."itemId"
    WHERE ic."collectionId" IN (${Prisma.join(collectionIds)})
    GROUP BY ic."collectionId", i."itemTypeId"
  `;

  if (rows.length === 0) {
    return new Map();
  }

  const types = await prisma.itemType.findMany({
    where: { id: { in: [...new Set(rows.map((row) => row.itemTypeId))] } },
    select: ITEM_TYPE_SELECT,
  });
  const typesById = new Map(types.map((type) => [type.id, type]));

  const byCollection = new Map<string, TypeUse[]>();

  for (const row of rows) {
    const type = typesById.get(row.itemTypeId);

    if (!type) {
      continue;
    }

    const uses = byCollection.get(row.collectionId) ?? [];
    uses.push({ type, count: row.count });
    byCollection.set(row.collectionId, uses);
  }

  // Ties break on label so the icon row is stable between renders, matching the
  // order the grouped rows would otherwise come back in arbitrarily.
  for (const uses of byCollection.values()) {
    uses.sort(
      (a, b) => b.count - a.count || a.type.label.localeCompare(b.type.label),
    );
  }

  return byCollection;
}
