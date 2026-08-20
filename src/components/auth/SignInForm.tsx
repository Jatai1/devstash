"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signInWithCredentials, signInWithGitHub } from "@/actions/auth";
import type { SignInState } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignInFormProps {
  /** Where to land after signing in, forwarded from the proxy's redirect. */
  callbackUrl: string;
  /** An Auth.js failure that happened during a redirect, already humanized. */
  initialError?: string;
}

interface SubmitButtonProps {
  children: React.ReactNode;
  /** Replaces the label while the action is in flight. */
  pendingLabel: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}

/**
 * A submit button that disables itself while its form is submitting.
 *
 * It has to be its own component: `useFormStatus` reports the status of the
 * form the calling component is rendered *inside*, so a hook call in the
 * component that renders the `<form>` would always read `pending: false`.
 */
function SubmitButton({ children, pendingLabel, variant }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} className="w-full" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

export function SignInForm({ callbackUrl, initialError }: SignInFormProps) {
  const [state, formAction] = useActionState<SignInState, FormData>(
    signInWithCredentials,
    initialError ? { error: initialError } : {},
  );

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

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
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGitHub}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <SubmitButton variant="outline" pendingLabel="Redirecting…">
          Sign in with GitHub
        </SubmitButton>
      </form>
    </div>
  );
}
