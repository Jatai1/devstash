import Link from "next/link";

import { CollectionCard } from "@/components/dashboard/CollectionCard";
import { Button } from "@/components/ui/button";
import { COLLECTIONS } from "@/lib/mock-data";

/** How many collections the dashboard grid shows before "View all". */
const RECENT_LIMIT = 6;

/** Grid of the most recently updated collections. */
export function RecentCollections() {
  const collections = [...COLLECTIONS]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_LIMIT);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Collections</h2>
        <Button asChild variant="link" size="lg">
          <Link href="/collections">View all</Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {collections.map((collection) => (
          <CollectionCard key={collection.id} collection={collection} />
        ))}
      </div>
    </section>
  );
}
