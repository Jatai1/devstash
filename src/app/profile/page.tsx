import type { Metadata } from "next";
import Link from "next/link";

import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { DeleteAccountDialog } from "@/components/profile/DeleteAccountDialog";
import { ProfileStats } from "@/components/profile/ProfileStats";
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
 * two account actions.
 *
 * `src/proxy.ts` matches `/profile/:path*`, so an anonymous request is
 * redirected to sign-in before this runs.
 */
export default async function ProfilePage() {
  const user = await getProfile();
  const displayName = user.name ?? user.email;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
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

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="grid gap-1">
              <dt className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Member since
              </dt>
              <dd>
                <time dateTime={user.createdAt.toISOString()}>
                  {formatLongDate(user.createdAt)}
                </time>
              </dd>
            </div>

            <div className="grid gap-1">
              <dt className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                Sign-in method
              </dt>
              {/* Derived from whether a password is set, which is the same
                  thing that decides whether the form below is offered — so the
                  two can never disagree. Lucide dropped its brand icons, so
                  this is text only, like the sign-in page's GitHub button. */}
              <dd>{user.hasPassword ? "Email and password" : "GitHub"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <ProfileStats />

      {user.hasPassword ? (
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Deleting your account removes every item, collection and tag you
            own. This cannot be undone.
          </p>
          <DeleteAccountDialog email={user.email} />
        </CardContent>
      </Card>

      <Link
        href="/dashboard"
        className="text-sm text-muted-foreground underline underline-offset-4"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
