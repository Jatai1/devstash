"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Folder, Star } from "lucide-react";

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
import { COLLECTIONS, type Collection } from "@/lib/mock-data";

/** How many non-favorite collections the "Recent" list shows. */
const RECENT_LIMIT = 5;

/**
 * Collapsible "Collections" group, split into the user's favorites and the
 * most recently updated of everything else.
 */
export function SidebarCollectionNav() {
  const pathname = usePathname();

  const favorites = COLLECTIONS.filter((collection) => collection.isFavorite);
  const recent = COLLECTIONS.filter((collection) => !collection.isFavorite)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_LIMIT);

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
              collections={favorites}
              pathname={pathname}
              showStar
            />
            <CollectionList
              heading="Recent"
              collections={recent}
              pathname={pathname}
            />
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

interface CollectionListProps {
  heading: string;
  collections: Collection[];
  pathname: string;
  /** Favorites show a star instead of the item count. */
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
                  collection.itemCount
                )}
              </SidebarMenuBadge>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </div>
  );
}
