import { Settings } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { CURRENT_USER } from "@/lib/mock-data";

/** Initials shown while there is no avatar image. */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Footer of the sidebar: the signed-in user plus a settings shortcut. Display
 * only — neither the row nor the gear is wired up yet.
 */
export function SidebarUserMenu() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip={CURRENT_USER.name}>
          <Avatar className="size-8 rounded-full">
            {CURRENT_USER.image ? (
              <AvatarImage src={CURRENT_USER.image} alt="" />
            ) : null}
            <AvatarFallback className="rounded-full text-xs">
              {getInitials(CURRENT_USER.name)}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left leading-tight">
            <span className="truncate text-sm font-medium">
              {CURRENT_USER.name}
            </span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              {CURRENT_USER.email}
            </span>
          </div>
        </SidebarMenuButton>
        <SidebarMenuAction className="top-4" aria-label="Settings">
          <Settings />
        </SidebarMenuAction>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
