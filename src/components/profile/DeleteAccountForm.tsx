"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { deleteAccount } from "@/actions/profile";
import type { DeleteAccountState } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** See `ChangePasswordForm` on why this is a separate component. */
function ConfirmButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Deleting…" : "Delete my account"}
    </Button>
  );
}

interface DeleteAccountFormProps {
  /** Typed back by the user to confirm, and shown so they know what to type. */
  email: string;
}

/**
 * Permanently deletes the account, behind a typed confirmation.
 *
 * A destructive button alone is one misclick from irreversible, so this asks for
 * the account's email address in full. The action re-checks what was typed, so
 * it is a real guard rather than a UI courtesy.
 *
 * This used to live behind an `AlertDialog` on the profile page. Reaching it now
 * means deliberately navigating to a page that does nothing else, which is the
 * same "are you sure" step the modal provided — so the modal would only be
 * asking twice. Dropping it also retires the reason its submit button could not
 * be an `AlertDialogAction`: that one closed the dialog on click, unmounting the
 * form mid-submit and taking any error message with it. Here there is nothing to
 * unmount, and an error simply renders under the field.
 */
export function DeleteAccountForm({ email }: DeleteAccountFormProps) {
  const [state, formAction] = useActionState<DeleteAccountState, FormData>(
    deleteAccount,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="confirmation">
          Type <span className="font-mono">{email}</span> to confirm
        </Label>
        <Input
          id="confirmation"
          name="confirmation"
          type="text"
          autoComplete="off"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? "confirmation-error" : undefined}
          required
        />
        {state.error ? (
          <p
            id="confirmation-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {state.error}
          </p>
        ) : null}
      </div>

      {/* Cancel leads, which is the order the `AlertDialog` this replaced used
          and the reason to keep it: on a destructive form the safe choice
          should be the one nearest to hand, not a link at the top of the page. */}
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/profile">Cancel</Link>
        </Button>
        <ConfirmButton />
      </div>
    </form>
  );
}
