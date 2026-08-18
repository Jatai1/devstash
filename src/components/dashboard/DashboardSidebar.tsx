import Link from "next/link";
import { Layers } from "lucide-react";

import { SidebarCollectionNav } from "@/components/dashboard/SidebarCollectionNav";
import { SidebarTypeNav } from "@/components/dashboard/SidebarTypeNav";
import { SidebarUserMenu } from "@/components/dashboard/SidebarUserMenu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { getSidebarCollections } from "@/lib/db/collections";
import { getItemTypes } from "@/lib/db/item-types";
import { getCurrentUserId } from "@/lib/db/user";

/**
 * Dashboard sidebar: the brand, the item types, the user's collections and the
 * current user. Collapses off-canvas on desktop and renders as a drawer on
 * mobile — both driven by the `SidebarTrigger` in the top bar.
 *
 * Both navs highlight the active route, so they are client components and
 * cannot query the database themselves — this server component loads their
 * data and hands it down.
 */
export async function DashboardSidebar() {
  const userId = await getCurrentUserId();
  const [types, collections] = await Promise.all([
    getItemTypes(userId),
    getSidebarCollections(userId),
  ]);

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/dashboard">
                <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <Layers className="size-4" />
                </span>
                <span className="text-base font-semibold">Devstash</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarTypeNav types={types} />
        <SidebarSeparator className="mx-2" />
        <SidebarCollectionNav collections={collections} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarUserMenu />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
