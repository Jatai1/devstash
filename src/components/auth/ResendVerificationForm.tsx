"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { resendVerificationEmail } from "@/actions/auth";
import type { ResendState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Send a new link"}
    </Button>
  );
}

interface ResendVerificationFormProps {
  /** Prefilled from the sign-in attempt, so the user does not retype it. */
  defaultEmail?: string;
}

/**
 * Requests a fresh verification link.
 *
 * Shown on the sign-in page once an attempt fails as unverified, and reachable
 * directly from an expired link.
 */
export function ResendVerificationForm({
  defaultEmail,
}: ResendVerificationFormProps) {
  const [state, formAction] = useActionState<ResendState, FormData>(
    resendVerificationEmail,
    {},
  );

  // The acknowledgement is deliberately the same for every outcome, so once it
  // has been shown there is nothing further to do on this form.
  if (state.message) {
    return (
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        {state.message}
      </p>
    );
  }

  return (
    // Bordered and headed, because it sits directly below the sign-in form and
    // repeats its email field — without a boundary the two read as one form
    // with a duplicated input.
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <div>
        <h2 className="text-sm font-medium">Didn&apos;t get the email?</h2>
        <p className="text-xs text-muted-foreground">
          We will send a new verification link.
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="resend-email" className="sr-only">
          Email for the new verification link
        </Label>
        <Input
          id="resend-email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={defaultEmail}
          placeholder="you@example.com"
          required
        />
      </div>

      <SubmitButton />
    </form>
  );
}
