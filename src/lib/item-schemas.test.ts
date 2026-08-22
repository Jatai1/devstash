import { describe, expect, it } from "vitest";
import { z } from "zod";

import { itemSchemaFor, parseTagInput } from "@/lib/item-schemas";

/**
 * Both helpers hand back an index-signature record rather than the schema's own
 * inferred type. `itemSchemaFor` returns a union of three schemas, so a
 * call with a union argument narrows to the fields all three share — and half
 * of what these tests assert is precisely that a field is *absent* for one kind
 * and present for another, which a static type cannot express here.
 */
type ParsedItem = Record<string, unknown>;
type FieldErrors = Record<string, string[] | undefined>;

/** The field-keyed errors an action would return for a rejected payload. */
function errorsFor(
  contentType: "TEXT" | "URL" | "FILE",
  input: unknown,
): FieldErrors | null {
  const parsed = itemSchemaFor(contentType).safeParse(input);

  if (parsed.success) {
    return null;
  }

  return z.flattenError(parsed.error).fieldErrors;
}

function parse(
  contentType: "TEXT" | "URL" | "FILE",
  input: unknown,
): ParsedItem {
  const parsed = itemSchemaFor(contentType).safeParse(input);

  if (!parsed.success) {
    throw new Error(
      `expected the payload to parse: ${JSON.stringify(
        z.flattenError(parsed.error).fieldErrors,
      )}`,
    );
  }

  return parsed.data;
}

describe("itemSchemaFor — every kind", () => {
  it("requires a title and trims it", () => {
    expect(parse("TEXT", { title: "  useAuth Hook  " }).title).toBe(
      "useAuth Hook",
    );

    expect(errorsFor("TEXT", { title: "   " })?.title).toEqual([
      "Title is required",
    ]);
  });

  /**
   * Blank means cleared, not `""`. Every read path treats an empty string as
   * present (`item.description && …`) and would render an empty paragraph.
   */
  it("turns a blanked optional field into null rather than an empty string", () => {
    expect(parse("TEXT", { title: "t", description: "   " }).description).toBe(
      null,
    );
  });

  /**
   * A missing key is the form not sending a field, which for a whole-record
   * update says the same thing as an emptied input. Left `undefined`, Prisma
   * would skip the column and clearing a description would silently do nothing.
   */
  it("defaults an absent optional field to null rather than undefined", () => {
    const data = parse("TEXT", { title: "t" });

    expect(data.description).toBe(null);
    expect(data.content).toBe(null);
    expect(data.language).toBe(null);
    expect(data.tags).toEqual([]);
  });

  it("rejects a title past the column's limit", () => {
    expect(errorsFor("TEXT", { title: "x".repeat(201) })?.title).toBeDefined();
  });
});

describe("itemSchemaFor — tags", () => {
  it("drops blanks and exact duplicates, keeping first-seen order", () => {
    expect(parse("TEXT", { title: "t", tags: [" b ", "", "a", "b"] }).tags)
      .toEqual(["b", "a"]);
  });

  /**
   * Case-sensitively, matching `@@unique([userId, name])` — Postgres stores
   * "React" and "react" as two rows, so collapsing them here would make the
   * badge row disagree with the tags that exist.
   */
  it("treats tags differing only in case as different tags", () => {
    expect(parse("TEXT", { title: "t", tags: ["React", "react"] }).tags).toEqual(
      ["React", "react"],
    );
  });

  it("counts tags after normalizing, so padding cannot inflate the total", () => {
    const twenty = Array.from({ length: 20 }, (_, index) => `tag${index}`);

    expect(parse("TEXT", { title: "t", tags: [...twenty, "", " "] }).tags)
      .toHaveLength(20);

    expect(
      errorsFor("TEXT", { title: "t", tags: [...twenty, "one-too-many"] })?.tags,
    ).toEqual(["At most 20 tags"]);
  });
});

describe("itemSchemaFor — payload fields by kind", () => {
  it("keeps content and language for a text item", () => {
    expect(
      parse("TEXT", {
        title: "t",
        content: "const x = 1;",
        language: "typescript",
      }),
    ).toMatchObject({ content: "const x = 1;", language: "typescript" });
  });

  /**
   * The enforcement that a payload cannot cross kinds: the field is not in the
   * schema, and Zod strips unknown keys, so it never reaches the database and
   * the action needs no check of its own.
   */
  it("strips a url submitted for a text item", () => {
    expect(parse("TEXT", { title: "t", url: "https://evil.example" })).not.toHaveProperty(
      "url",
    );
  });

  it("strips content and language submitted for a link", () => {
    const data = parse("URL", {
      title: "t",
      url: "https://nextjs.org/docs",
      content: "ignored",
      language: "ignored",
    });

    expect(data).not.toHaveProperty("content");
    expect(data).not.toHaveProperty("language");
    expect(data.url).toBe("https://nextjs.org/docs");
  });

  it("gives a file item no payload field at all", () => {
    const data = parse("FILE", { title: "t", content: "x", url: "https://a.co" });

    expect(Object.keys(data).sort()).toEqual(["description", "tags", "title"]);
  });
});

describe("itemSchemaFor — url", () => {
  it("accepts http and https", () => {
    expect(parse("URL", { title: "t", url: "http://a.co" }).url).toBe(
      "http://a.co",
    );
    expect(parse("URL", { title: "t", url: "https://a.co/x?y=1" }).url).toBe(
      "https://a.co/x?y=1",
    );
  });

  /**
   * The reason the protocol is pinned rather than left to `z.url()`, which
   * accepts this: the drawer renders the value straight into an `<a href>`, so a
   * saved `javascript:` URL would be an XSS payload for whoever clicked it.
   */
  it("rejects a javascript: URL", () => {
    expect(errorsFor("URL", { title: "t", url: "javascript:alert(1)" })?.url)
      .toEqual(["Enter a valid http:// or https:// URL"]);
  });

  it("rejects other protocols and plain text", () => {
    expect(errorsFor("URL", { title: "t", url: "ftp://a.co" })?.url).toBeDefined();
    expect(errorsFor("URL", { title: "t", url: "not a url" })?.url).toBeDefined();
  });

  it("treats a cleared box as null rather than an invalid URL", () => {
    expect(parse("URL", { title: "t", url: "  " }).url).toBe(null);
  });
});

describe("parseTagInput", () => {
  it("splits on commas and trims", () => {
    expect(parseTagInput("react, hooks ,auth")).toEqual([
      "react",
      "hooks",
      "auth",
    ]);
  });

  it("drops empty segments from trailing or doubled commas", () => {
    expect(parseTagInput("react,, hooks, ")).toEqual(["react", "hooks"]);
  });

  it("is empty for an empty box", () => {
    expect(parseTagInput("")).toEqual([]);
    expect(parseTagInput("   ")).toEqual([]);
  });
});
