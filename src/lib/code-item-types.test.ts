import { describe, expect, it } from "vitest";

import { isCodeItemType } from "@/lib/code-item-types";

describe("isCodeItemType", () => {
  it("recognizes the two code types", () => {
    expect(isCodeItemType("snippet")).toBe(true);
    expect(isCodeItemType("command")).toBe(true);
  });

  /**
   * The other two `TEXT` types are the whole reason this is keyed on the name
   * rather than on `contentKind`: all four store the same columns, and only
   * these two want a code editor rendering them.
   */
  it("leaves the prose text types on the textarea", () => {
    expect(isCodeItemType("prompt")).toBe(false);
    expect(isCodeItemType("note")).toBe(false);
  });

  it("does not claim the non-text types", () => {
    for (const name of ["link", "file", "image"]) {
      expect(isCodeItemType(name)).toBe(false);
    }
  });

  /**
   * A user-defined type cannot be on a fixed list, so it gets the textarea —
   * the same control every text item had before the code editor existed.
   */
  it("answers no for a custom type", () => {
    expect(isCodeItemType("terraform")).toBe(false);
  });

  /**
   * `ItemType.name` is stored lowercase and is the stable identifier, so this
   * deliberately does not normalize: a lookup that quietly accepted "Snippet"
   * would hide a caller passing `label` where it meant `name`.
   */
  it("matches the stored name exactly", () => {
    expect(isCodeItemType("Snippet")).toBe(false);
    expect(isCodeItemType("Snippets")).toBe(false);
    expect(isCodeItemType("snippets")).toBe(false);
    expect(isCodeItemType("")).toBe(false);
  });
});
