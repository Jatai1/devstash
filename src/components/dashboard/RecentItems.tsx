import { Clock } from "lucide-react";

import { ItemCard } from "@/components/dashboard/ItemCard";
import { ITEMS } from "@/lib/mock-data";

/** How many recent items the dashboard lists. */
const RECENT_LIMIT = 10;

/**
 * The most recently updated items. Pinned items are left out because they
 * already have their own section directly above this one.
 */
export function RecentItems() {
  const recent = ITEMS.filter((item) => !item.isPinned)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_LIMIT);

  if (recent.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Clock className="size-4 text-muted-foreground" />
        Recent
      </h2>

      <div className="space-y-3">
        {recent.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
