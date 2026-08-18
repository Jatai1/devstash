import { cookies } from "next/headers";

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardTopBar } from "@/components/dashboard/DashboardTopBar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
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
