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
