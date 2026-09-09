/**
 * Item types whose body is prose written in Markdown, keyed by `ItemType.name`
 * for the same reason `src/lib/code-item-types.ts` and `src/lib/pro.ts` are: a
 * `label` or a `slug` can be reworded without changing what the row *is*.
 *
 * This is the second half of a split the code editor started, and the two lists
 * are meant to be read together. Both are **presentational** and neither says
 * anything about which columns a type stores — `contentKind` still answers that
 * alone, and all four of `snippet`, `command`, `prompt` and `note` are `TEXT`,
 * so all four have a Content field and a Language field. What the two lists
 * decide is only which *control* renders the Content field: code goes to Monaco,
 * prose goes to the Markdown editor, and anything in neither list falls back to
 * the plain textarea that predates both.
 *
 * Keeping this a closed list rather than writing it as "TEXT and not code" is
 * deliberate. The complement would quietly hand the Markdown editor to every
 * custom `TEXT` type a user creates, which is not what the spec's "notes and
 * prompts only" asks for and not how `isCodeItemType` treats a custom type. The
 * cost is that the two lists could in principle drift into overlap, where a name
 * in both would make the control depend on which branch a surface tested first;
 * `markdown-item-types.test.ts` asserts they stay disjoint.
 */
const MARKDOWN_ITEM_TYPE_NAMES = new Set(["note", "prompt"]);

/**
 * Whether a type's body should be edited and displayed as Markdown.
 *
 * A custom type answers `false` and keeps the plain textarea. Letting a user
 * mark their own type as Markdown is the same later feature that would let them
 * mark one as code: it needs a column on `ItemType`, at which point both lists
 * become the default for the seven system types rather than the whole answer.
 */
export function isMarkdownItemType(name: string): boolean {
  return MARKDOWN_ITEM_TYPE_NAMES.has(name);
}
