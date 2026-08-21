"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { deleteAccount } from "@/actions/profile";
import type { DeleteAccountState } from "@/actions/profile";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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

interface DeleteAccountDialogProps {
  /** Typed back by the user to confirm, and shown so they know what to type. */
  email: string;
}

/**
 * Permanently deletes the account, behind a typed confirmation.
 *
 * A destructive button alone is one misclick from irreversible, so the dialog
 * asks for the account's email address in full. The action re-checks what was
 * typed, so this is a real guard rather than a UI courtesy.
 *
 * The submit button is a plain `Button` rather than an `AlertDialogAction`:
 * that one closes the dialog as soon as it is clicked, which would unmount the
 * form mid-submit and take any error message with it.
 */
export function DeleteAccountDialog({ email }: DeleteAccountDialogProps) {
  const [state, formAction] = useActionState<DeleteAccountState, FormData>(
    deleteAccount,
    {},
  );

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="w-fit">
          Delete account
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes your account along with every item,
            collection and tag you own. It cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>

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

          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <ConfirmButton />
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
