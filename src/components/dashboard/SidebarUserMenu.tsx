import { getCurrentUser } from "@/lib/db/user";

import { SidebarUserMenuContent } from "./SidebarUserMenuContent";

/**
 * Footer of the sidebar: the signed-in user, linking to their profile, with a
 * dropdown holding sign out.
 *
 * The query stays here rather than in the client component below — this is
 * where the request-cached `getCurrentUser()` can be awaited directly.
 */
export async function SidebarUserMenu() {
  const user = await getCurrentUser();

  return (
    <SidebarUserMenuContent
      // Unnamed accounts still need something to show, and the email is the
      // only other identifier this row has.
      displayName={user.name ?? user.email}
      email={user.email}
      image={user.image}
    />
  );
}
