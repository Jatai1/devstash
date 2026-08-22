import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ItemCard } from "@/components/dashboard/ItemCard";
import { TypeIcon } from "@/components/dashboard/TypeIcon";
import { getItemTypeBySlug } from "@/lib/db/item-types";
import { getItemsByType } from "@/lib/db/items";
import { getCurrentUserId } from "@/lib/db/user";

// Reads the session and the user's items, so there is nothing to prerender —
// and the slug set is per-user, since custom types are rows rather than routes.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/items/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const userId = await getCurrentUserId();
  const type = await getItemTypeBySlug(userId, slug);

  // The null branch is a fallback rather than something a user sees: the page
  // calls `notFound()` for the same segment, and Next's not-found page supplies
  // its own title over this one.
  return { title: type ? `${type.label} · Devstash` : "Not found · Devstash" };
}

/**
 * Every item the user filed under one type — the destination of the sidebar's
 * "Types" nav and the profile's type breakdown.
 *
 * `src/proxy.ts` matches `/items/:path*`, so an anonymous request is redirected
 * to sign-in before this runs.
 */
export default async function ItemsByTypePage({
  params,
}: PageProps<"/items/[slug]">) {
  const { slug } = await params;
  const userId = await getCurrentUserId();
  const type = await getItemTypeBySlug(userId, slug);

  // An unknown slug and someone else's custom type are the same answer here:
  // this user has no such page. Rendering an empty grid instead would say the
  // type exists and is empty, which is a different and wrong claim.
  if (!type) {
    notFound();
  }

  const items = await getItemsByType(userId, type.id);

  return (
    <div className="space-y-8">
      <header className="flex items-center gap-3">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-xl"
          // 1a === 10% alpha, matching the tile on every item card below.
          style={{ backgroundColor: `${type.color}1a`, color: type.color }}
        >
          <TypeIcon name={type.icon} className="size-5" aria-hidden />
        </span>

        <div className="min-w-0 space-y-1">
          <h1 className="truncate text-3xl font-semibold tracking-tight">
            {type.label}
          </h1>
          <p className="text-muted-foreground">
            {items.length === 1 ? "1 item" : `${items.length} items`}
          </p>
        </div>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing stashed under {type.label} yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
