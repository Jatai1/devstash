import { Folder, Layers, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { TypeIcon } from "@/components/dashboard/TypeIcon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCollectionStats } from "@/lib/db/collections";
import { getItemTypes } from "@/lib/db/item-types";
import { getItemStats } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";

/**
 * What the signed-in user has stashed: two headline counters and a per-type
 * breakdown.
 *
 * All three queries are the ones the dashboard already uses, so the numbers
 * here and the numbers on the dashboard cannot disagree. `getItemTypes` counts
 * per user, so a system type shared by every account still reports only this
 * user's items, and lists types they have never used with a 0 rather than
 * hiding them — the breakdown is meant to show the whole shape of what is
 * available, not just what has been filled in.
 */
export async function ProfileStats() {
  const userId = await getCurrentUserId();
  const [items, collections, types] = await Promise.all([
    getItemStats(userId),
    getCollectionStats(userId),
    getItemTypes(userId),
  ]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <Headline label="Items" value={items.total} icon={Layers} />
          <Headline
            label="Collections"
            value={collections.total}
            icon={Folder}
          />
        </div>

        <div>
          <h3 className="mb-3 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            By type
          </h3>

          <ul className="grid gap-1 sm:grid-cols-2">
            {types.map((type) => (
              <li key={type.id}>
                <Link
                  href={`/items/${type.slug}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <TypeIcon
                    name={type.icon}
                    className="size-4 shrink-0"
                    style={{ color: type.color }}
                    aria-hidden
                  />
                  <span className="truncate">{type.label}</span>
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {type.itemCount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

interface HeadlineProps {
  label: string;
  value: number;
  icon: LucideIcon;
}

/** One of the two large counters above the breakdown. */
function Headline({ label, value, icon: Icon }: HeadlineProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
      </div>
      <Icon className="size-5 shrink-0 text-muted-foreground" />
    </div>
  );
}
