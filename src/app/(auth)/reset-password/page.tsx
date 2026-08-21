import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { checkPasswordResetToken } from "@/lib/password-reset-tokens";

export const metadata: Metadata = {
  title: "Reset password · Devstash",
};

// Reads a single-use token, so there is nothing cacheable here.
export const dynamic = "force-dynamic";

const FAILURE_COPY = {
  expired: {
    title: "That link has expired",
    body: "Reset links are good for one hour. Request a new one and we will send a fresh link.",
  },
  invalid: {
    title: "That link is not valid",
    body: "It may have already been used, a newer link may have replaced it, or the address was cut off in your email client. Requesting a new link will fix any of those.",
  },
} as const;

/**
 * The target of the link in the password reset email.
 *
 * The token is checked before the form renders so a dead link says so straight
 * away instead of after the user has typed a password twice — but that check is
 * deliberately non-consuming, or the form it just rendered could never be
 * submitted. `resetPassword` re-checks and spends the token for real.
 *
 * It sits in the `(auth)` group for the shared shell and stays out of the
 * `src/proxy.ts` matcher: a protected reset link would redirect to sign-in
 * before it ever ran, which is precisely what someone who cannot sign in
 * does not need.
 */
export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const { token } = await searchParams;
  const rawToken = typeof token === "string" ? token : "";
  const check = await checkPasswordResetToken(rawToken);

  if (!check.ok) {
    const { title, body } = FAILURE_COPY[check.reason];

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
          <p>{body}</p>
          <Link
            href="/forgot-password"
            className="text-foreground underline underline-offset-4"
          >
            Request a new link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set a new password</CardTitle>
        <CardDescription>
          Choose a new password for {check.email}.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ResetPasswordForm token={rawToken} />
      </CardContent>
    </Card>
  );
}
