import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BackToProfile } from "@/components/profile/BackToProfile";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile } from "@/lib/db/user";

export const metadata: Metadata = {
  title: "Change password · Devstash",
};

// Reads the session and the user's row, so there is nothing to prerender.
export const dynamic = "force-dynamic";

/**
 * Changes the password of an account that has one.
 *
 * A GitHub-only account is sent back to the profile rather than shown a form it
 * could never submit — there is no current password for it to prove. The button
 * that leads here is hidden for those accounts, but the URL is typeable, and
 * `changePassword` refuses independently of both.
 */
export default async function ChangePasswordPage() {
  const { hasPassword } = await getProfile();

  if (!hasPassword) {
    redirect("/profile");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackToProfile />

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
