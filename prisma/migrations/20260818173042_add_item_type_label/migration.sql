-- Add `label` to `ItemType`: the display name shown in the UI ("Snippets"), kept
-- separate from `name`, which stays the stable lowercase identifier ("snippet")
-- used by lookups and the unique constraints.
--
-- Same nullable -> backfill -> NOT NULL sequence as the previous migration, since
-- the seven seeded system types already occupy this table.

-- AlterTable
ALTER TABLE "ItemType" ADD COLUMN     "label" TEXT;

-- Backfill: labels for the system types, per `context/project-overview.md` §7.
UPDATE "ItemType"
SET "label" = CASE "name"
    WHEN 'snippet' THEN 'Snippets'
    WHEN 'prompt'  THEN 'Prompts'
    WHEN 'command' THEN 'Commands'
    WHEN 'note'    THEN 'Notes'
    WHEN 'link'    THEN 'Links'
    WHEN 'file'    THEN 'Files'
    WHEN 'image'   THEN 'Images'
    -- custom types cannot exist yet, but fall back to the name rather than null
    ELSE initcap("name")
  END
WHERE "label" IS NULL;

-- Enforce the constraint the schema declares.
ALTER TABLE "ItemType" ALTER COLUMN "label" SET NOT NULL;
