import { cookies } from "next/headers";

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Shared shell for the signed-in pages.
 *
 * The route group keeps `/dashboard` and `/profile` at the top level of the URL
 * while letting them share one sidebar, the same way `(auth)` frames the
 * signed-out pages. The top bar comes with it rather than being dashboard-only:
 * it owns the `SidebarTrigger`, which is the only way to reopen a collapsed
 * sidebar on desktop and the only way to open the drawer at all on mobile.
 *
 * Every route under here is matched by `src/proxy.ts`, so an anonymous request
 * is redirected to sign-in before any of it renders.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  // The sidebar writes its open/closed state to a cookie; reading it here keeps
  // the server render in sync so the sidebar doesn't flash open on reload.
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    // The sidebar menu buttons render tooltips, which need a provider above them.
    <TooltipProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <DashboardSidebar />
        <SidebarInset className="min-w-0">
          <DashboardTopBar />
          <div className="flex-1 px-6 py-8">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
