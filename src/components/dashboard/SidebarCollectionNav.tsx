"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Folder, LayoutGrid, Star } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { CollectionSummary, SidebarCollections } from "@/lib/db/collections";

interface SidebarCollectionNavProps {
  /** Loaded by `DashboardSidebar`; this component needs `usePathname`. */
  collections: SidebarCollections;
}

/**
 * Collapsible "Collections" group, split into the user's favorites and the
 * most recently updated of everything else, with a link to the full list.
 */
export function SidebarCollectionNav({
  collections,
}: SidebarCollectionNavProps) {
  const pathname = usePathname();

  return (
    <Collapsible defaultOpen className="group/collections">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="w-full gap-1">
            Collections
            <ChevronDown className="transition-transform group-data-[state=closed]/collections:-rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>

        <CollapsibleContent>
          <SidebarGroupContent className="space-y-2">
            <CollectionList
              heading="Favorites"
              collections={collections.favorites}
              pathname={pathname}
              showStar
            />
            <CollectionList
              heading="Recent"
              collections={collections.recent}
              pathname={pathname}
            />

            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/collections"}
                  tooltip="View all collections"
                  className="text-sidebar-foreground/70"
                >
                  <Link href="/collections">
                    <LayoutGrid />
                    <span>View all collections</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

interface CollectionListProps {
  heading: string;
  collections: CollectionSummary[];
  pathname: string;
  /** Favorites show a star; everything else shows a dominant-type dot. */
  showStar?: boolean;
}

function CollectionList({
  heading,
  collections,
  pathname,
  showStar = false,
}: CollectionListProps) {
  if (collections.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="px-2 py-1 text-xs font-medium tracking-wider text-sidebar-foreground/50 uppercase">
        {heading}
      </p>
      <SidebarMenu>
        {collections.map((collection) => {
          const href = `/collections/${collection.id}`;

          return (
            <SidebarMenuItem key={collection.id}>
              <SidebarMenuButton
                asChild
                isActive={pathname === href}
                tooltip={collection.name}
              >
                <Link href={href}>
                  <Folder />
                  <span>{collection.name}</span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuBadge>
                {showStar ? (
                  <Star
                    className="size-3.5 fill-amber-400 text-amber-400"
                    aria-label="Favorite"
                  />
                ) : (
                  <DominantTypeDot type={collection.dominantType} />
                )}
              </SidebarMenuBadge>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </div>
  );
}

/**
 * The color of the type most of a collection's items use. Renders nothing for
 * an empty collection with no default type, since there is no color to show.
 */
function DominantTypeDot({
  type,
}: {
  type: CollectionSummary["dominantType"];
}) {
  if (!type) {
    return null;
  }

  return (
    <span
      className="size-2.5 rounded-full"
      style={{ backgroundColor: type.color }}
      title={type.label}
      aria-label={type.label}
      role="img"
    />
  );
}
