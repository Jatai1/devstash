import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Devstash",
};

/**
 * Main area placeholder. Phase 3 fills this in with the collections grid and
 * the pinned items list.
 */
export default function DashboardPage() {
  return <h2 className="text-lg font-semibold">Main</h2>;
}
