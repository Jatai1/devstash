import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user/UserAvatar";
import { getCurrentUser } from "@/lib/db/user";

export const metadata: Metadata = {
  title: "Profile · Devstash",
};

// Reads the session and the user's row, so there is nothing to prerender.
export const dynamic = "force-dynamic";

/**
 * The signed-in user's profile.
 *
 * Read only for now — the sidebar's avatar links here, and editing a profile is
 * its own feature. `src/proxy.ts` matches `/profile/:path*`, so an anonymous
 * request is redirected before this runs.
 */
export default async function ProfilePage() {
  const user = await getCurrentUser();
  const displayName = user.name ?? user.email;

  return (
    <div className="mx-auto w-full max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <UserAvatar
              image={user.image}
              displayName={displayName}
              className="size-16 text-lg"
            />
            <div className="grid gap-1">
              <span className="text-lg font-medium">{displayName}</span>
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>

          <Link
            href="/dashboard"
            className="text-sm text-muted-foreground underline underline-offset-4"
          >
            Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
