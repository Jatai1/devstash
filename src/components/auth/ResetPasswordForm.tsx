"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { resetPassword } from "@/actions/password-reset";
import type { ResetPasswordState } from "@/actions/password-reset";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** See the note in `ForgotPasswordForm` on why this is a separate component. */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Saving…" : "Set new password"}
    </Button>
  );
}

/** The fields the form renders, in the order they appear. */
const FIELDS = ["password", "confirmPassword"] as const;

const LABELS = {
  password: "New password",
  confirmPassword: "Confirm new password",
} as const;

interface ResetPasswordFormProps {
  /**
   * The raw token from the link. Submitted as a hidden field rather than read
   * from the URL server-side, so the action validates exactly what was sent.
   */
  token: string;
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, formAction] = useActionState<ResetPasswordState, FormData>(
    resetPassword,
    {},
  );

  // The page already checked the token before rendering this form, but it can
  // expire or be superseded between that render and this submit — so the form
  // has to be able to become a failure message on its own.
  if (state.tokenInvalid) {
    return (
      <div className="flex flex-col gap-4 text-sm">
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-destructive"
        >
          {state.error}
        </p>
        <Link
          href="/forgot-password"
          className="text-foreground underline underline-offset-4"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      {FIELDS.map((field) => {
        const errors = state.fieldErrors?.[field];

        return (
          <div key={field} className="grid gap-2">
            <Label htmlFor={field}>{LABELS[field]}</Label>
            <Input
              id={field}
              name={field}
              type="password"
              autoComplete="new-password"
              aria-invalid={errors ? true : undefined}
              aria-describedby={errors ? `${field}-error` : undefined}
              required
            />
            {errors ? (
              <p id={`${field}-error`} className="text-sm text-destructive">
                {errors[0]}
              </p>
            ) : null}
          </div>
        );
      })}

      <SubmitButton />
    </form>
  );
}
