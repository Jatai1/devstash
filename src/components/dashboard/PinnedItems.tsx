import { Pin } from "lucide-react";

import { ItemList } from "@/components/dashboard/ItemList";
import { getPinnedItems } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";

/** Items the user pinned to the top of the dashboard, newest first. */
export async function PinnedItems() {
  const userId = await getCurrentUserId();
  const pinned = await getPinnedItems(userId);

  if (pinned.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-xl font-semibold">
        <Pin className="size-4 text-muted-foreground" />
        Pinned
      </h2>

      <ItemList items={pinned} className="space-y-3" />
    </section>
  );
}
