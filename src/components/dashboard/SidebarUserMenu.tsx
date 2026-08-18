import { Settings } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getCurrentUser } from "@/lib/db/user";

/**
 * Initials shown while there is no avatar image. Falls back to the first
 * character of whatever the row has, since `User.name` is nullable.
 */
function getInitials(name: string): string {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (initials || name.slice(0, 1)).toUpperCase();
}

/**
 * Footer of the sidebar: the signed-in user plus a settings shortcut. The gear
 * is display only — it is not wired up yet.
 */
export async function SidebarUserMenu() {
  const user = await getCurrentUser();
  // Unnamed accounts still need something to show, and the email is the only
  // other identifier this row has.
  const displayName = user.name ?? user.email;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" tooltip={displayName}>
          <Avatar className="size-8 rounded-full">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback className="rounded-full text-xs">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left leading-tight">
            <span className="truncate text-sm font-medium">{displayName}</span>
            <span className="truncate text-xs text-sidebar-foreground/60">
              {user.email}
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
