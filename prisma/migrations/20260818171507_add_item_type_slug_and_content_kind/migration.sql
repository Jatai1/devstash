-- Add `slug` and `contentKind` to `ItemType`.
--
-- Both are required, but `ItemType` already holds the seven seeded system types,
-- so Postgres will not accept a NOT NULL column without a default on a populated
-- table. Add them nullable, backfill, then enforce NOT NULL.

-- AlterTable
ALTER TABLE "ItemType" ADD COLUMN     "slug" TEXT,
ADD COLUMN     "contentKind" "ItemContentKind";

-- Backfill: every existing row is a system type (no custom types exist yet), so
-- matching on `name` is unambiguous. Slugs are the plural route segment used by
-- /items/[slug]; content kinds come from `context/project-overview.md` §3A.
UPDATE "ItemType" SET "slug" = "name" || 's' WHERE "slug" IS NULL;

UPDATE "ItemType"
SET "contentKind" = CASE "name"
    WHEN 'link' THEN 'URL'::"ItemContentKind"
    WHEN 'file' THEN 'FILE'::"ItemContentKind"
    WHEN 'image' THEN 'FILE'::"ItemContentKind"
    ELSE 'TEXT'::"ItemContentKind"
  END
WHERE "contentKind" IS NULL;

-- Enforce the constraints the schema declares. If the backfill missed a row this
-- fails loudly instead of leaving nulls behind.
ALTER TABLE "ItemType" ALTER COLUMN "slug" SET NOT NULL,
ALTER COLUMN "contentKind" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ItemType_userId_slug_key" ON "ItemType"("userId", "slug");
