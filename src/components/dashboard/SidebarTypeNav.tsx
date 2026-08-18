"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";

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
import type { ItemTypeNavSummary } from "@/lib/db/item-types";
import { getIcon } from "@/lib/icons";

interface SidebarTypeNavProps {
  /** Loaded by `DashboardSidebar`; this component needs `usePathname`. */
  types: ItemTypeNavSummary[];
}

/**
 * Collapsible "Types" group. Each row links to the type's item list and shows
 * how many items it holds.
 */
export function SidebarTypeNav({ types }: SidebarTypeNavProps) {
  const pathname = usePathname();

  return (
    <Collapsible defaultOpen className="group/types">
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger className="w-full gap-1">
            Types
            <ChevronDown className="transition-transform group-data-[state=closed]/types:-rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>

        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              {types.map((type) => {
                const Icon = getIcon(type.icon);
                const href = `/items/${type.slug}`;

                return (
                  <SidebarMenuItem key={type.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === href}
                      tooltip={type.label}
                    >
                      <Link href={href}>
                        <Icon style={{ color: type.color }} />
                        <span>{type.label}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuBadge>{type.itemCount}</SidebarMenuBadge>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
