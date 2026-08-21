import type { Metadata } from "next";
import Link from "next/link";

import { SignInForm } from "@/components/auth/SignInForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  EMAIL_NOT_VERIFIED_CODE,
  getAuthErrorMessage,
  resolveAuthErrorCode,
} from "@/lib/auth-errors";
import { isEmailVerificationEnabled } from "@/lib/email-verification";

export const metadata: Metadata = {
  title: "Sign in · Devstash",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { callbackUrl, error, code, verified, unverified, registered } =
    await searchParams;

  const failureCode = resolveAuthErrorCode(
    typeof error === "string" ? error : undefined,
    typeof code === "string" ? code : undefined,
  );
  const isUnverified = failureCode === EMAIL_NOT_VERIFIED_CODE;
  const verificationEnabled = isEmailVerificationEnabled();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Welcome back. Sign in to reach your stash.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <SignInForm
          // Passed in rather than rendered here so the form can drop it once a
          // sign-in attempt produces an error, instead of leaving a stale
          // notice sitting above the error.
          //
          // `verified` is set by /verify-email once a token is consumed.
          // `registered` only arrives when email verification is switched off:
          // with it on, registration goes to /check-email instead, so "ready to
          // sign in" is only ever shown when it is actually true.
          notice={
            verified
              ? "Your email is verified. Sign in to continue."
              : registered
                ? "Your account is ready. Sign in to continue."
                : undefined
          }
          callbackUrl={typeof callbackUrl === "string" ? callbackUrl : "/dashboard"}
          // Auth.js redirects its own failures here as `?error=<code>`; this is
          // where `OAuthAccountNotLinked` becomes a sentence rather than a code.
          initialError={
            typeof failureCode === "string"
              ? getAuthErrorMessage(failureCode)
              : undefined
          }
          // Arrivals from an expired or already-used link get the resend form
          // straight away, without having to fail a sign-in first.
          //
          // Gated on the flag because `?unverified=1` is a plain URL — reachable
          // from an old link, or by hand — where `EmailNotVerified` can only be
          // produced by the gate. Without this the form would still be offered
          // with verification switched off, promising a link that the resend
          // action would then decline to send.
          initialEmailNotVerified={
            verificationEnabled && (Boolean(unverified) || isUnverified)
          }
        />
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        <span>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-foreground underline underline-offset-4">
            Register
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
