import { Folder, FolderHeart, Layers, Star, type LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { getCollectionStats } from "@/lib/db/collections";
import { getItemStats } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";
import { cn } from "@/lib/utils";

interface Stat {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Tailwind text color for the icon. */
  iconClassName: string;
}

/** The four counters above the dashboard content, all counted in the database. */
export async function DashboardStats() {
  const userId = await getCurrentUserId();
  const [items, collections] = await Promise.all([
    getItemStats(userId),
    getCollectionStats(userId),
  ]);

  const stats: Stat[] = [
    {
      label: "Items",
      value: items.total,
      icon: Layers,
      iconClassName: "text-muted-foreground",
    },
    {
      label: "Collections",
      value: collections.total,
      icon: Folder,
      iconClassName: "text-muted-foreground",
    },
    {
      label: "Favorite Items",
      value: items.favorites,
      icon: Star,
      iconClassName: "text-amber-400",
    },
    {
      label: "Favorite Collections",
      value: collections.favorites,
      icon: FolderHeart,
      iconClassName: "text-amber-400",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, icon: Icon, iconClassName }) => (
        <Card key={label}>
          <CardContent className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium tracking-wider text-muted-foreground uppercase">
                {label}
              </p>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
            <Icon className={cn("size-5 shrink-0", iconClassName)} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
