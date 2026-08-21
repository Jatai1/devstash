import type { Metadata } from "next";
import Link from "next/link";

import { ProfileStats } from "@/components/profile/ProfileStats";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user/UserAvatar";
import { getProfile } from "@/lib/db/user";
import { formatLongDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Profile · Devstash",
};

// Reads the session and the user's row, so there is nothing to prerender.
export const dynamic = "force-dynamic";

/**
 * The signed-in user's profile: who they are, what they have stashed, and the
 * way through to the two account actions.
 *
 * Both actions live on their own pages rather than inline here. Each is a form
 * that asks for something back — the current password, or the email address
 * typed in full — and neither is what someone came to this page to do, so the
 * page reads as a summary with two doors out of it.
 *
 * `src/proxy.ts` matches `/profile/:path*`, so an anonymous request is
 * redirected to sign-in before this runs — and the same matcher covers the two
 * sub-pages with no change.
 */
export default async function ProfilePage() {
  const user = await getProfile();
  const displayName = user.name ?? user.email;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
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
            <div className="grid min-w-0 gap-1">
              <span className="truncate text-lg font-medium">
                {displayName}
              </span>
              <span className="truncate text-sm text-muted-foreground">
                {user.email}
              </span>
            </div>
          </div>

          <dl className="grid gap-1 text-sm">
            <dt className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
              Member since
            </dt>
            <dd>
              <time dateTime={user.createdAt.toISOString()}>
                {formatLongDate(user.createdAt)}
              </time>
            </dd>
          </dl>

          {/* The account actions live in this card rather than one of their
              own: both are about the identity above them, and a card holding
              nothing but two buttons was a heading earning its keep only by
              repeating what the buttons already said. */}
          <div className="flex flex-wrap gap-3 border-t pt-6">
            {/* Hidden for a GitHub-only account, which has no current password
                to prove. `changePassword` enforces that itself, so the button
                is the signpost rather than the guard. */}
            {user.hasPassword ? (
              <Button asChild variant="outline">
                <Link href="/profile/change-password">Change password</Link>
              </Button>
            ) : null}

            <Button asChild variant="destructive">
              <Link href="/profile/delete-account">Delete account</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProfileStats />
    </div>
  );
}
