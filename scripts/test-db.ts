/**
 * Smoke-tests the Neon connection and the generated Prisma client.
 *
 * Run with: npm run test:db
 *
 * Prisma 7 does not load `.env` implicitly, so `dotenv/config` has to be
 * imported before anything reads `process.env`. This connects through the same
 * pooled `DATABASE_URL` and driver adapter the app uses, not the unpooled
 * `DIRECT_URL` the Prisma CLI uses for migrations.
 *
 * The write test runs inside a transaction that is always rolled back, so the
 * script leaves no rows behind and is safe to re-run.
 */
import "dotenv/config";

import { prisma } from "@/lib/prisma";

class Rollback extends Error {}

async function reportConnection() {
  const [info] = await prisma.$queryRaw<
    { database: string; version: string }[]
  >`SELECT current_database() AS database, version() AS version`;

  console.log(`✔ connected to "${info.database}"`);
  console.log(`  ${info.version.split(" on ")[0]}`);
}

async function reportRowCounts() {
  const counts = {
    users: await prisma.user.count(),
    accounts: await prisma.account.count(),
    sessions: await prisma.session.count(),
    itemTypes: await prisma.itemType.count(),
    items: await prisma.item.count(),
    collections: await prisma.collection.count(),
    tags: await prisma.tag.count(),
  };

  console.log("\n✔ all tables reachable — row counts:");
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(12)} ${count}`);
  }
}

async function testWriteRoundTrip() {
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: `test-db-${Date.now()}@example.com`, name: "test-db" },
      });

      const itemType = await tx.itemType.create({
        data: {
          name: "test-db-type",
          label: "Test DB Types",
          slug: "test-db-types",
          icon: "Code",
          color: "#3b82f6",
          contentKind: "TEXT",
          // a user-owned custom type, so the cascade below covers it too
          isSystem: false,
          userId: user.id,
        },
      });

      const item = await tx.item.create({
        data: {
          title: "test-db round trip",
          contentType: "TEXT",
          content: "console.log('hello')",
          isPinned: true,
          userId: user.id,
          itemTypeId: itemType.id,
        },
      });

      const collection = await tx.collection.create({
        data: { name: "test-db", userId: user.id, defaultTypeId: itemType.id },
      });

      await tx.itemCollection.create({
        data: { itemId: item.id, collectionId: collection.id },
      });

      const tag = await tx.tag.create({ data: { name: "test-db", userId: user.id } });
      await tx.itemTag.create({ data: { itemId: item.id, tagId: tag.id } });

      const withRelations = await tx.item.findUniqueOrThrow({
        where: { id: item.id },
        include: { itemType: true, collections: true, tags: true },
      });

      console.log("\n✔ write round trip:");
      console.log(`  item "${withRelations.title}" (${withRelations.contentType})`);
      console.log(`  type: ${withRelations.itemType.name}`);
      console.log(`  in ${withRelations.collections.length} collection(s), ${withRelations.tags.length} tag(s)`);

      // Deleting the owner should cascade to everything it owns.
      await tx.user.delete({ where: { id: user.id } });

      console.log("\n✔ cascade from User:");
      console.log(`  items left:       ${await tx.item.count({ where: { userId: user.id } })}`);
      console.log(`  collections left: ${await tx.collection.count({ where: { userId: user.id } })}`);
      console.log(`  tags left:        ${await tx.tag.count({ where: { userId: user.id } })}`);
      console.log(`  itemTypes left:   ${await tx.itemType.count({ where: { userId: user.id } })}`);
      console.log(`  itemTags left:    ${await tx.itemTag.count({ where: { itemId: item.id } })}`);

      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
    console.log("\n✔ transaction rolled back — no rows written");
  }
}

async function main() {
  await reportConnection();
  await reportRowCounts();
  await testWriteRoundTrip();
}

main()
  .then(() => {
    console.log("\nDatabase OK");
  })
  .catch((error: unknown) => {
    console.error("\nDatabase test failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
