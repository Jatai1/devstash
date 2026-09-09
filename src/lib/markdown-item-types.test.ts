import { describe, expect, it } from "vitest";

import { isCodeItemType } from "@/lib/code-item-types";
import { isMarkdownItemType } from "@/lib/markdown-item-types";

describe("isMarkdownItemType", () => {
  it("recognizes the two prose types", () => {
    expect(isMarkdownItemType("note")).toBe(true);
    expect(isMarkdownItemType("prompt")).toBe(true);
  });

  /**
   * The two code types are the reason this is keyed on the name rather than on
   * `contentKind`: all four `TEXT` types store the same columns, and only these
   * two want prose rendering rather than a code editor.
   */
  it("leaves the code text types to the code editor", () => {
    expect(isMarkdownItemType("snippet")).toBe(false);
    expect(isMarkdownItemType("command")).toBe(false);
  });

  it("does not claim the non-text types", () => {
    for (const name of ["link", "file", "image"]) {
      expect(isMarkdownItemType(name)).toBe(false);
    }
  });

  /**
   * A user-defined type cannot be on a fixed list, so it gets the plain
   * textarea. This is the case that would change if the predicate were written
   * as "TEXT and not code" instead of a closed list, which is exactly why it is
   * not.
   */
  it("answers no for a custom type", () => {
    expect(isMarkdownItemType("journal")).toBe(false);
  });

  /**
   * `ItemType.name` is stored lowercase and is the stable identifier, so this
   * deliberately does not normalize: a lookup that quietly accepted "Note"
   * would hide a caller passing `label` where it meant `name`.
   */
  it("matches the stored name exactly", () => {
    expect(isMarkdownItemType("Note")).toBe(false);
    expect(isMarkdownItemType("Notes")).toBe(false);
    expect(isMarkdownItemType("notes")).toBe(false);
    expect(isMarkdownItemType("")).toBe(false);
  });

  /**
   * The two lists pick between two different controls for the same field, so a
   * name on both would make the rendered editor depend on which predicate a
   * surface happened to test first — and the three surfaces test them in the
   * same order today only by convention.
   */
  it("never overlaps with the code types", () => {
    for (const name of ["snippet", "command", "note", "prompt", "link"]) {
      expect(isMarkdownItemType(name) && isCodeItemType(name)).toBe(false);
    }
  });
});
