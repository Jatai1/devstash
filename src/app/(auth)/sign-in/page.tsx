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

export const metadata: Metadata = {
  title: "Sign in · Devstash",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { callbackUrl, error, code, registered, verified, unverified } =
    await searchParams;

  const failureCode = resolveAuthErrorCode(
    typeof error === "string" ? error : undefined,
    typeof code === "string" ? code : undefined,
  );
  const isUnverified = failureCode === EMAIL_NOT_VERIFIED_CODE;

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
          // sign-in attempt produces an error — otherwise a stale "please
          // verify" notice would sit directly above the error saying the same
          // thing. `registered` is set by the register form, `verified` by
          // /verify-email after a token is consumed.
          notice={
            registered
              ? "Please verify your account."
              : verified
                ? "Your email is verified. Sign in to continue."
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
          initialEmailNotVerified={Boolean(unverified) || isUnverified}
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
