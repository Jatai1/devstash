import { Clock } from "lucide-react";

import { ItemCard } from "@/components/dashboard/ItemCard";
import { getRecentItems } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";

/**
 * The most recently updated items. Pinned items are left out because they
 * already have their own section directly above this one.
 */
export async function RecentItems() {
  const userId = await getCurrentUserId();
  const recent = await getRecentItems(userId);

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
