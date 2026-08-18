import type { Metadata } from "next";

import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { PinnedItems } from "@/components/dashboard/PinnedItems";
import { RecentCollections } from "@/components/dashboard/RecentCollections";
import { RecentItems } from "@/components/dashboard/RecentItems";

export const metadata: Metadata = {
  title: "Dashboard | Devstash",
};

// The page reads the database on every request, so it must not be prerendered
// at build time — that would bake one snapshot of the data into static HTML.
export const dynamic = "force-dynamic";

/** Dashboard main area: counters, recent collections, pinned and recent items. */
export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your developer knowledge hub</p>
      </header>

      <DashboardStats />
      <RecentCollections />
      <PinnedItems />
      <RecentItems />
    </div>
  );
}
