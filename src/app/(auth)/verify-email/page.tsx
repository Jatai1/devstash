import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { consumeVerificationToken } from "@/lib/verification-tokens";

export const metadata: Metadata = {
  title: "Verify email · Devstash",
};

// Consumes a single-use token, so there is nothing cacheable here.
export const dynamic = "force-dynamic";

const FAILURE_COPY = {
  expired: {
    title: "That link has expired",
    body: "Verification links are good for 24 hours. Request a new one and we will send a fresh link.",
  },
  invalid: {
    title: "That link is not valid",
    body: "It may have already been used, or the address was cut off in your email client. Requesting a new link will fix either.",
  },
} as const;

/**
 * The target of the link in the verification email.
 *
 * A GET that mutates is not ideal, but it is what clicking a link in an email
 * can produce, and the token being single-use is what keeps a repeat request
 * from doing anything a second time. It sits in the `(auth)` group for the
 * shared shell and stays out of the `src/proxy.ts` matcher — a protected
 * verification link would redirect to sign-in before it ever ran.
 */
export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/verify-email">) {
  const { token } = await searchParams;
  const result = await consumeVerificationToken(
    typeof token === "string" ? token : "",
  );

  if (result.ok) {
    // Nothing to render on success: the next step is signing in, and the
    // sign-in page already knows how to say so.
    redirect("/sign-in?verified=1");
  }

  const { title, body } = FAILURE_COPY[result.reason];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 text-sm text-muted-foreground">
        <p>{body}</p>
        <Link
          href="/sign-in?unverified=1"
          className="text-foreground underline underline-offset-4"
        >
          Request a new link
        </Link>
      </CardContent>
    </Card>
  );
}
