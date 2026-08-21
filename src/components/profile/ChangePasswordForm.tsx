"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

import { changePassword } from "@/actions/profile";
import type { ChangePasswordState } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Separate component so `useFormStatus` reports *this* form's status —
 * a hook call in the component rendering the `<form>` always reads
 * `pending: false`.
 */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-fit">
      {pending ? "Saving…" : "Change password"}
    </Button>
  );
}

/** The fields the form renders, in the order they appear. */
const FIELDS = ["currentPassword", "password", "confirmPassword"] as const;

const LABELS = {
  currentPassword: "Current password",
  password: "New password",
  confirmPassword: "Confirm new password",
} as const;

const AUTOCOMPLETE = {
  currentPassword: "current-password",
  password: "new-password",
  confirmPassword: "new-password",
} as const;

/**
 * Changes the password of an account that has one.
 *
 * Only rendered for email/password users — a GitHub account has no current
 * password to prove — though the action enforces that itself, since a Server
 * Action can be called without the form.
 */
export function ChangePasswordForm() {
  const [state, formAction] = useActionState<ChangePasswordState, FormData>(
    changePassword,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clearing on success matters more than usual here: leaving three filled
  // password boxes on screen invites a second submit that would now fail,
  // because the password they name is no longer the current one.
  //
  // Keyed on `succeededAt` rather than `message`, which is the same string on
  // every success — so two changes in one page load would have compared equal
  // and skipped the reset the second time.
  useEffect(() => {
    if (state.succeededAt) {
      formRef.current?.reset();
    }
  }, [state.succeededAt]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      {state.message ? (
        <p
          role="status"
          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-500"
        >
          {state.message}
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
              autoComplete={AUTOCOMPLETE[field]}
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

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton />
        {/* The way through for someone who cannot supply the current password.
            It proves control of the mailbox instead, which is the same evidence
            every other reset relies on. */}
        <Link
          href="/forgot-password"
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          Forgot your current password?
        </Link>
      </div>
    </form>
  );
}
