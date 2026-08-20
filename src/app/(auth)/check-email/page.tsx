import { MailCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Check your email · Devstash",
};

/**
 * Where registration lands.
 *
 * A page of its own rather than a notice on the sign-in form: the account
 * cannot sign in yet, so putting the message above a form the user is not able
 * to use invites them to try anyway. Nothing here is secret and no session
 * exists yet, so it stays outside the `src/proxy.ts` matcher.
 */
export default async function CheckEmailPage({
  searchParams,
}: PageProps<"/check-email">) {
  const { email } = await searchParams;
  // Shown so a mistyped address is obvious here rather than after waiting for
  // mail that was never going to arrive. Display only — nothing is looked up.
  const address = typeof email === "string" ? email : null;

  return (
    <Card>
      <CardHeader>
        <div
          aria-hidden
          className="mb-2 flex size-10 items-center justify-center rounded-full bg-muted"
        >
          <MailCheck className="size-5" />
        </div>
        <CardTitle>Check your email</CardTitle>
        <CardDescription>
          {address ? (
            <>
              We sent a verification link to{" "}
              <span className="font-medium text-foreground">{address}</span>.
              Click it to finish setting up your account.
            </>
          ) : (
            "We sent you a verification link. Click it to finish setting up your account."
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          The link expires in 24 hours. If it does not arrive, check your spam
          folder — you can request a new one from the sign-in page.
        </p>

        <Button asChild variant="outline" className="w-full">
          <Link href="/sign-in">Back to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
