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
import { getAuthErrorMessage } from "@/lib/auth-errors";

export const metadata: Metadata = {
  title: "Sign in · Devstash",
};

export default async function SignInPage({
  searchParams,
}: PageProps<"/sign-in">) {
  const { callbackUrl, error, registered } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Welcome back. Sign in to reach your stash.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Set by the register form after a successful signup, so arriving here
            reads as the next step rather than as a failure. */}
        {registered ? (
          <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            Your account is ready. Sign in to continue.
          </p>
        ) : null}

        <SignInForm
          callbackUrl={typeof callbackUrl === "string" ? callbackUrl : "/dashboard"}
          // Auth.js redirects its own failures here as `?error=<code>`; this is
          // where `OAuthAccountNotLinked` becomes a sentence rather than a code.
          initialError={
            typeof error === "string" ? getAuthErrorMessage(error) : undefined
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
