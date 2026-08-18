/**
 * Seeds the immutable system item types.
 *
 * Run with: npx prisma db seed
 *
 * Prisma 7 no longer seeds automatically after `prisma migrate dev`, so this has
 * to be invoked explicitly. It is idempotent — re-running it updates the icon and
 * colour of existing system types rather than inserting duplicates.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";

/**
 * Colours and Lucide icon names come from `context/project-overview.md` §7,
 * content kinds from §3A. Slugs are the route segment used by /items/[slug].
 */
const SYSTEM_ITEM_TYPES = [
  { name: "snippet", label: "Snippets", slug: "snippets", icon: "Code", color: "#3b82f6", contentKind: "TEXT" },
  { name: "prompt", label: "Prompts", slug: "prompts", icon: "Sparkles", color: "#8b5cf6", contentKind: "TEXT" },
  { name: "command", label: "Commands", slug: "commands", icon: "Terminal", color: "#f97316", contentKind: "TEXT" },
  { name: "note", label: "Notes", slug: "notes", icon: "StickyNote", color: "#fde047", contentKind: "TEXT" },
  { name: "link", label: "Links", slug: "links", icon: "Link", color: "#10b981", contentKind: "URL" },
  { name: "file", label: "Files", slug: "files", icon: "File", color: "#6b7280", contentKind: "FILE" },
  { name: "image", label: "Images", slug: "images", icon: "Image", color: "#ec4899", contentKind: "FILE" },
] as const;

async function seedSystemItemTypes() {
  for (const type of SYSTEM_ITEM_TYPES) {
    // `@@unique([userId, name])` cannot identify these rows: Postgres treats NULLs
    // as distinct in a unique index, so `userId: null` never matches an existing
    // row and `upsert` would insert a duplicate on every run.
    const existing = await prisma.itemType.findFirst({
      where: { name: type.name, userId: null },
    });

    if (existing) {
      await prisma.itemType.update({
        where: { id: existing.id },
        data: {
          label: type.label,
          slug: type.slug,
          icon: type.icon,
          color: type.color,
          contentKind: type.contentKind,
          isSystem: true,
        },
      });
      console.log(`  = ${type.name} (updated)`);
    } else {
      await prisma.itemType.create({
        data: { ...type, isSystem: true, userId: null },
      });
      console.log(`  + ${type.name} (created)`);
    }
  }
}

async function main() {
  console.log("Seeding system item types...");
  await seedSystemItemTypes();

  const total = await prisma.itemType.count({ where: { isSystem: true } });
  console.log(`\nDone — ${total} system item types in the database.`);
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
