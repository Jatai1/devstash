/**
 * Item types the Pro plan covers, keyed by `ItemType.name` — the stable
 * identifier, not the display `label` or the route `slug`, either of which can
 * be reworded without changing what the row *is*.
 *
 * Which types are Pro is a product decision (`context/project-overview.md` §5
 * marks `file` and `image`), not a per-row fact, so `ItemType` carries no
 * column for it and the list lives here.
 */
const PRO_ITEM_TYPE_NAMES = new Set(["file", "image"]);

/**
 * Whether a type belongs to the Pro plan.
 *
 * This only drives display. Pro access is unenforced during development — every
 * user can file items under every type — so the badge marks the type without
 * gating it.
 */
export function isProItemType(name: string): boolean {
  return PRO_ITEM_TYPE_NAMES.has(name);
}
