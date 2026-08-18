import { prisma } from "@/lib/prisma";

/**
 * The parts of an `ItemType` the dashboard cards render: the icon and color
 * drive a card's tile and left border, the label its accessible name.
 */
export interface ItemTypeSummary {
  id: string;
  /** Plural display name, e.g. "Snippets". */
  label: string;
  /** Lucide icon name, e.g. "Code". */
  icon: string;
  /** Hex color, e.g. "#3b82f6". */
  color: string;
}

/** The `select` that produces an `ItemTypeSummary`. */
export const ITEM_TYPE_SELECT = {
  id: true,
  label: true,
  icon: true,
  color: true,
} as const;

/** An item type as the sidebar's "Types" nav renders it. */
export interface ItemTypeNavSummary extends ItemTypeSummary {
  /** Route segment behind `/items/[slug]`, e.g. "snippets". */
  slug: string;
  /** How many of the user's items use this type. */
  itemCount: number;
}

/**
 * Every type the user can file an item under: the seven immutable system types
 * (`userId: null`) plus any custom types they defined.
 *
 * The count is scoped to the user, so a system type shared by every account
 * still reports only their own items — and reports 0 for a type they have not
 * used yet, which the nav still lists.
 *
 * `ItemType` carries no sort column, so system types lead and each group falls
 * back to insertion order; `label` only breaks ties between rows written in the
 * same instant.
 */
export async function getItemTypes(
  userId: string,
): Promise<ItemTypeNavSummary[]> {
  const types = await prisma.itemType.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }, { label: "asc" }],
    select: {
      ...ITEM_TYPE_SELECT,
      slug: true,
      _count: { select: { items: { where: { userId } } } },
    },
  });

  return types.map(({ _count, ...type }) => ({
    ...type,
    itemCount: _count.items,
  }));
}
