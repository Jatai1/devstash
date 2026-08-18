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
      items: {
        select: { item: { select: { itemType: { select: ITEM_TYPE_SELECT } } } },
      },
    },
  });

  return collections.map((collection) => {
    const types = rankTypesByUse(
      collection.items.map(({ item }) => item.itemType),
    );

    return {
      id: collection.id,
      name: collection.name,
      description: collection.description,
      isFavorite: collection.isFavorite,
      itemCount: collection.items.length,
      dominantType: types[0] ?? collection.defaultType,
      types,
      updatedAt: collection.updatedAt,
    };
  });
}

/**
 * Deduplicates one type per distinct id and orders them by how many items use
 * them, breaking ties on label so the icon row is stable between renders.
 */
function rankTypesByUse(types: ItemTypeSummary[]): ItemTypeSummary[] {
  const counts = new Map<string, { type: ItemTypeSummary; count: number }>();

  for (const type of types) {
    const seen = counts.get(type.id);

    if (seen) {
      seen.count += 1;
    } else {
      counts.set(type.id, { type, count: 1 });
    }
  }

  return [...counts.values()]
    .sort(
      (a, b) => b.count - a.count || a.type.label.localeCompare(b.type.label),
    )
    .map((entry) => entry.type);
}
