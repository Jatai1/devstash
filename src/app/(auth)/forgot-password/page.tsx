import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Forgot password · Devstash",
};

export default async function ForgotPasswordPage({
  searchParams,
}: PageProps<"/forgot-password">) {
  // Carried over from the sign-in form when the user gives up on a password
  // they have already typed once.
  const { email } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot your password?</CardTitle>
        <CardDescription>
          Enter your email and we will send you a link to set a new one.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <ForgotPasswordForm
          defaultEmail={typeof email === "string" ? email : undefined}
        />
      </CardContent>

      <CardFooter className="justify-center text-sm text-muted-foreground">
        <span>
          Remembered it?{" "}
          <Link
            href="/sign-in"
            className="text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </span>
      </CardFooter>
    </Card>
  );
}
