import Link from "next/link";

import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { Button } from "@/components/ui/button";
import { getRecentCollections } from "@/lib/db/collections";
import { getCurrentUserId } from "@/lib/db/user";

/** Grid of the most recently updated collections. */
export async function RecentCollections() {
  const userId = await getCurrentUserId();
  const collections = await getRecentCollections(userId);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Collections</h2>
        <Button asChild variant="link" size="lg">
          <Link href="/collections">View all</Link>
        </Button>
      </div>

      {collections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No collections yet. Create one to start grouping your items.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard key={collection.id} collection={collection} />
          ))}
        </div>
      )}
    </section>
  );
}
