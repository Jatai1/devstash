"use client";

import { ChevronsUpDown, LogOut, User } from "lucide-react";
import Link from "next/link";

import { signOutAction } from "@/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/user/UserAvatar";

interface SidebarUserMenuContentProps {
  displayName: string;
  email: string;
  image: string | null;
}

/**
 * The interactive half of the sidebar footer.
 *
 * A client component because the dropdown needs state and `useSidebar` decides
 * which side it opens on; the user's details are queried by the server
 * component that renders this and arrive as props.
 */
export function SidebarUserMenuContent({
  displayName,
  email,
  image,
}: SidebarUserMenuContentProps) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={displayName}
              className="data-[state=open]:bg-sidebar-accent"
            >
              <UserAvatar image={image} displayName={displayName} />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">
                  {displayName}
                </span>
                <span className="truncate text-xs text-sidebar-foreground/60">
                  {email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 opacity-60" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            align="end"
            sideOffset={4}
            // Upward on desktop, where the footer sits at the bottom of a
            // full-height sidebar; downward in the mobile drawer, where there
            // is no room above it.
            side={isMobile ? "bottom" : "top"}
          >
            <DropdownMenuLabel className="flex items-center gap-2 font-normal">
              <UserAvatar image={image} displayName={displayName} />
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">
                  {displayName}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <Link href="/profile">
                <User />
                Profile
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* A form rather than an `onClick`: signing out is a mutation, and
                this way it still works before the JavaScript has hydrated. */}
            <form action={signOutAction}>
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut />
                  Sign out
                </button>
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
