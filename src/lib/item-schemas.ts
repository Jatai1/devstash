import { z } from "zod";

import type { ItemContentKind } from "@/generated/prisma/client";

/**
 * Validation for the item mutations, modeled on `src/lib/auth-schemas.ts`:
 * shared fragments composed into per-case schemas, so a rule cannot apply to
 * one path and not another.
 *
 * The cases are the three `ItemContentKind` values, **not** the seven item
 * types. A schema is chosen by the `contentType` stored on the row, so adding an
 * eighth type changes nothing here — see `docs/item-types.md`.
 */

/** Column caps. `content` is `@db.Text`, so its limit is a sanity bound. */
export const TITLE_MAX_LENGTH = 200;
export const DESCRIPTION_MAX_LENGTH = 500;
export const CONTENT_MAX_LENGTH = 100_000;
export const LANGUAGE_MAX_LENGTH = 50;
export const URL_MAX_LENGTH = 2048;
export const TAG_MAX_LENGTH = 50;
export const TAGS_MAX_COUNT = 20;

/**
 * Blank input clears an optional column to `NULL` rather than storing `""`.
 *
 * The drawer's inputs are controlled strings, so "cleared" arrives as an empty
 * string. Without this, `description` would end up holding `""`, which every
 * read path treats as present (`item.description && …`) and renders as an empty
 * paragraph.
 */
function blankToNull(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed === "" ? null : trimmed;
}

/**
 * An optional text column.
 *
 * `.default(null)` rather than `.optional()`: a missing key means the form did
 * not send the field, and for a full-record update that is the same statement as
 * an emptied input. Leaving it `undefined` would make Prisma skip the column, so
 * clearing a description would silently do nothing.
 */
function optionalText(max: number, label: string) {
  return z.preprocess(
    blankToNull,
    z
      .string()
      .max(max, `${label} must be at most ${max} characters`)
      .nullable()
      .default(null),
  );
}

/**
 * Every item carries these, whatever its type.
 *
 * `title` is the only required field: an item with no title has nothing to
 * render in a card, a drawer heading or a search result.
 */
const itemBaseFields = {
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(
      TITLE_MAX_LENGTH,
      `Title must be at most ${TITLE_MAX_LENGTH} characters`,
    ),

  description: optionalText(DESCRIPTION_MAX_LENGTH, "Description"),

  tags: z
    .array(
      z
        .string()
        .max(
          TAG_MAX_LENGTH,
          `A tag must be at most ${TAG_MAX_LENGTH} characters`,
        ),
    )
    .default([])
    // Normalizing before the count check is deliberate: blanks and duplicates
    // are dropped rather than counted, so "a, a, a," is one tag, not four.
    .transform(normalizeTagNames)
    .pipe(
      z
        .array(z.string())
        .max(TAGS_MAX_COUNT, `At most ${TAGS_MAX_COUNT} tags`),
    ),
};

/** Snippet, prompt, command, note — anything whose payload is a text body. */
const textItemSchema = z.object({
  ...itemBaseFields,
  content: optionalText(CONTENT_MAX_LENGTH, "Content"),
  language: optionalText(LANGUAGE_MAX_LENGTH, "Language"),
});

/**
 * Links.
 *
 * The protocol is restricted to `http`/`https` rather than accepting whatever
 * `new URL()` parses. Bare `z.url()` admits `javascript:alert(1)`, and the
 * drawer renders this value straight into an `<a href>` — which would make a
 * saved item an XSS payload for whoever clicks it.
 */
const urlItemSchema = z.object({
  ...itemBaseFields,
  url: z.preprocess(
    blankToNull,
    z
      .url({
        protocol: /^https?$/,
        error: "Enter a valid http:// or https:// URL",
      })
      .max(URL_MAX_LENGTH, `URL must be at most ${URL_MAX_LENGTH} characters`)
      .nullable()
      .default(null),
  ),
});

/**
 * Files and images.
 *
 * No payload field: the body is a blob behind `fileUrl`, which is written by an
 * upload rather than typed into the drawer. Nothing uploads yet.
 */
const fileItemSchema = z.object(itemBaseFields);

/**
 * The schema for one item's editable fields, chosen by what it stores.
 *
 * Fields belonging to another kind are not in the returned object, and Zod
 * strips unknown keys — so a `url` submitted for a text item is dropped before
 * it can reach the database, without the action having to check for it.
 */
export function itemUpdateSchemaFor(contentType: ItemContentKind) {
  switch (contentType) {
    case "TEXT":
      return textItemSchema;
    case "URL":
      return urlItemSchema;
    case "FILE":
      return fileItemSchema;
  }
}

/** The fields an update can report an error against. */
export type ItemUpdateField =
  | "title"
  | "description"
  | "tags"
  | "content"
  | "language"
  | "url";

/**
 * Splits the drawer's comma-separated tag box into names.
 *
 * Lives here rather than in the component so the form and the schema agree on
 * what a tag is, and so the rule is testable without rendering anything.
 */
export function parseTagInput(value: string): string[] {
  return normalizeTagNames(value.split(","));
}

/**
 * Trims, drops blanks and removes exact duplicates, preserving first-seen order.
 *
 * Deduplication is **case-sensitive**, matching `@@unique([userId, name])` —
 * Postgres treats "React" and "react" as two rows, so collapsing them here would
 * make the badge row disagree with the tags that actually exist. It is not
 * optional either: `ItemTag` is keyed `@@id([itemId, tagId])`, so a repeated
 * name would collide on insert.
 */
function normalizeTagNames(names: string[]): string[] {
  const seen = new Set<string>();

  for (const name of names) {
    const trimmed = name.trim();

    if (trimmed !== "") {
      seen.add(trimmed);
    }
  }

  return [...seen];
}
