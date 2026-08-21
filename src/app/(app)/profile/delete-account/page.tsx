import type { Metadata } from "next";

import { BackToProfile } from "@/components/profile/BackToProfile";
import { DeleteAccountForm } from "@/components/profile/DeleteAccountForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getProfile } from "@/lib/db/user";

export const metadata: Metadata = {
  title: "Delete account · Devstash",
};

// Reads the session and the user's row, so there is nothing to prerender.
export const dynamic = "force-dynamic";

/**
 * Permanently deletes the signed-in account.
 *
 * The page carries nothing else, so arriving here is already a deliberate act —
 * which is what lets the confirmation be a typed email address on the page
 * rather than a modal on top of it. `deleteAccount` re-checks what was typed.
 */
export default async function DeleteAccountPage() {
  const { email } = await getProfile();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <BackToProfile />

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Delete account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            This permanently deletes your account along with every item,
            collection and tag you own. It cannot be undone.
          </p>
          <DeleteAccountForm email={email} />
        </CardContent>
      </Card>
    </div>
  );
}
