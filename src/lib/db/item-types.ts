import { cache } from "react";

import type { ItemContentKind } from "@/generated/prisma/client";
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

/**
 * The type behind one item in the detail drawer.
 *
 * Adds `name` to what a card needs, because the drawer is where the body is
 * rendered and `isCodeItemType` keys on the name. Deliberately a *second*
 * select rather than a wider `ITEM_TYPE_SELECT`: only the detail path reads the
 * name, and widening the shared one would add a column to every item list,
 * every collection card and the sidebar — the same trade-off the item-create
 * feature declined when it wanted `contentKind`.
 */
export interface ItemTypeDetailSummary extends ItemTypeSummary {
  /** Stable identifier, e.g. "snippet" — see `isCodeItemType`. */
  name: string;
}

/** The `select` that produces an `ItemTypeDetailSummary`. */
export const ITEM_TYPE_DETAIL_SELECT = {
  ...ITEM_TYPE_SELECT,
  name: true,
} as const;

/** An item type as the sidebar's "Types" nav renders it. */
export interface ItemTypeNavSummary extends ItemTypeSummary {
  /** Stable identifier, e.g. "snippet" — see `isProItemType`. */
  name: string;
  /** Route segment behind `/items/[slug]`, e.g. "snippets". */
  slug: string;
  /** How many of the user's items use this type. */
  itemCount: number;
}

/**
 * The type behind an `/items/[slug]` segment, or `null` when the segment names
 * nothing this user can see — a custom type belonging to someone else reads the
 * same as a typo, and both should 404.
 *
 * `@@unique([userId, slug])` only constrains a slug per owner, so a custom type
 * is free to reuse a system type's slug. System types lead here for the same
 * reason they lead in `getItemTypes()`: the resolution has to be stable, and the
 * seeded types are the ones every link in the app already points at.
 *
 * `cache` dedupes it, so a page and its `generateMetadata` — which both have to
 * resolve the same segment — cost one query between them.
 */
export const getItemTypeBySlug = cache(
  async (userId: string, slug: string): Promise<ItemTypeSummary | null> => {
    return prisma.itemType.findFirst({
      where: { slug, OR: [{ userId: null }, { userId }] },
      orderBy: { isSystem: "desc" },
      select: ITEM_TYPE_SELECT,
    });
  },
);

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
/** An item type as the create form's picker offers it. */
export interface CreatableItemType extends ItemTypeSummary {
  /** Stable identifier, e.g. "snippet" — see `isProItemType`. */
  name: string;
  /** Which payload fields the form should render. */
  contentKind: ItemContentKind;
}

/**
 * The types a new item may be filed under, in the picker's order.
 *
 * `FILE` kinds are excluded because nothing uploads yet: offering one would
 * create an item whose payload is a blob that has no way to arrive, and whose
 * drawer already says as much. The filter is on the **kind**, not on the
 * `file`/`image` names, so a future custom FILE type is excluded on the same
 * grounds rather than slipping through a name list.
 *
 * That leaves exactly the five types the spec names, plus any custom TEXT or
 * URL type the user has defined — which a hardcoded list could not have
 * offered.
 *
 * `cache` dedupes it per request, since the top bar renders on every page in
 * the signed-in shell.
 */
export const getCreatableItemTypes = cache(
  async (userId: string): Promise<CreatableItemType[]> => {
    return prisma.itemType.findMany({
      where: {
        OR: [{ userId: null }, { userId }],
        contentKind: { not: "FILE" },
      },
      orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }, { label: "asc" }],
      select: { ...ITEM_TYPE_SELECT, name: true, contentKind: true },
    });
  },
);

/**
 * One type a new item may be filed under, or `null` when the id names nothing
 * this user may use.
 *
 * **This is the authorization check for `itemTypeId`.** That id arrives from
 * the client and `Item.itemTypeId` is a plain unscoped FK, so without the
 * `userId` predicate a crafted submit could file an item under another user's
 * custom type — which would then render that user's label and color in the
 * attacker's sidebar. `docs/item-crud-architecture.md` §5 flags it; the drawer's
 * edit mode avoided it entirely by making the type non-editable, so create is
 * where it has to be enforced.
 *
 * It excludes `FILE` on the same grounds as the picker: a type the form will
 * not offer is not one a submission may name.
 */
export async function getCreatableItemType(
  userId: string,
  id: string,
): Promise<(CreatableItemType & { slug: string }) | null> {
  return prisma.itemType.findFirst({
    where: {
      id,
      OR: [{ userId: null }, { userId }],
      contentKind: { not: "FILE" },
    },
    select: {
      ...ITEM_TYPE_SELECT,
      name: true,
      contentKind: true,
      slug: true,
    },
  });
}

export async function getItemTypes(
  userId: string,
): Promise<ItemTypeNavSummary[]> {
  const types = await prisma.itemType.findMany({
    where: { OR: [{ userId: null }, { userId }] },
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }, { label: "asc" }],
    select: {
      ...ITEM_TYPE_SELECT,
      name: true,
      slug: true,
      _count: { select: { items: { where: { userId } } } },
    },
  });

  return types.map(({ _count, ...type }) => ({
    ...type,
    itemCount: _count.items,
  }));
}
