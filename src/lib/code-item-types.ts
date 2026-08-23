/**
 * Item types whose body is code, keyed by `ItemType.name` — the stable
 * identifier, not the display `label` or the route `slug`, either of which can
 * be reworded without changing what the row *is*. Same reasoning, and the same
 * shape, as `src/lib/pro.ts`.
 *
 * This is the project's **only** branch on a type's name that decides more than
 * a badge, so it is worth being explicit about why it is not keyed on
 * `contentKind` like everything else in `docs/item-types.md` says to be.
 * `snippet`, `command`, `prompt` and `note` are all `contentKind: TEXT`, and
 * that kind is the right key for *which columns a type stores* — it is what
 * decides that all four get a Content field and a Language field, and it still
 * does. What it cannot answer is which **control** should render that field: a
 * note is prose, and prose in a code editor is a regression, so the split here
 * is presentational and the kind carries no information about it.
 *
 * The distinction matters because it is the line the create/edit forms must not
 * cross. Both surfaces agree on the *fields* an item has, because both read
 * `contentKind`; they agree on the *editor* because both read this list. What
 * would break the item is the two disagreeing, which is what happens if one
 * surface branches on the name and the other on the kind.
 */
const CODE_ITEM_TYPE_NAMES = new Set(["snippet", "command"]);

/**
 * Whether a type's body should be edited and displayed as code.
 *
 * A custom type answers `false` — a name list cannot recognize one, and the
 * fallback is the plain textarea every text item had before the code editor
 * existed. Letting a user mark their own type as code is a later feature; it
 * would need a column on `ItemType`, at which point this list becomes the
 * default for the seven system types rather than the whole answer.
 */
export function isCodeItemType(name: string): boolean {
  return CODE_ITEM_TYPE_NAMES.has(name);
}
