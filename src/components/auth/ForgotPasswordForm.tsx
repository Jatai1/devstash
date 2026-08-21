"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { requestPasswordReset } from "@/actions/password-reset";
import type { ForgotPasswordState } from "@/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Its own component because `useFormStatus` reports the status of the form the
 * calling component is rendered *inside* — a hook call in the component that
 * renders the `<form>` would always read `pending: false`.
 */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Sending…" : "Email me a reset link"}
    </Button>
  );
}

interface ForgotPasswordFormProps {
  /** Prefilled from a failed sign-in, so the user does not retype it. */
  defaultEmail?: string;
}

export function ForgotPasswordForm({ defaultEmail }: ForgotPasswordFormProps) {
  const [state, formAction] = useActionState<ForgotPasswordState, FormData>(
    requestPasswordReset,
    {},
  );

  // The acknowledgement is deliberately the same for every outcome, so once it
  // has been shown there is nothing further to do on this form. Replacing the
  // form rather than leaving it open also stops a second submit from being the
  // obvious next action when no mail arrives.
  if (state.message) {
    return (
      <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
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
