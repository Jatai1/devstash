import { Pin } from "lucide-react";

import { ItemCard } from "@/components/dashboard/ItemCard";
import { ITEMS } from "@/lib/mock-data";

/** Items the user pinned to the top of the dashboard, newest first. */
export function PinnedItems() {
  const pinned = ITEMS.filter((item) => item.isPinned).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  if (pinned.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Pin className="size-4 text-muted-foreground" />
        Pinned
      </h2>

      <div className="space-y-3">
        {pinned.map((item) => (
          <ItemCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
