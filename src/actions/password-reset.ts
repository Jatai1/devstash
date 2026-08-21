"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/auth-schemas";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset-email";
import {
  createPasswordResetToken,
  resetPasswordWithToken,
} from "@/lib/password-reset-tokens";
import { prisma } from "@/lib/prisma";

export interface ForgotPasswordState {
  /** Rendered as-is; identical for every outcome. See below. */
  message?: string;
  error?: string;
}

/**
 * What the caller is told regardless of what actually happened.
 *
 * An unknown address, a real send, and even a send that failed all produce this
 * one sentence. Saying "no account with that email" would turn an
 * unauthenticated form into a way to test which addresses are registered — the
 * same reasoning that keeps `authorize` and the resend form vague, and the
 * reason this is worded as what *will* happen rather than what did.
 */
const ACKNOWLEDGEMENT =
  "If that address has an account, a password reset link is on its way.";

/**
 * Emails a password reset link.
 *
 * Unlike `resendVerificationEmail`, this reports a *send failure* as success
 * too. That form is only reachable once the caller has already proven the
 * address exists by getting its password right, so admitting a failure there
 * revealed nothing further. Here nothing has been proven, and an error that
 * only ever appears for real accounts is exactly the enumeration oracle the
 * shared acknowledgement exists to prevent. The failure is logged instead, so
 * it is visible to us rather than to the person asking.
 *
 * Rate limiting remains out of scope project-wide, which leaves this as a
 * fourth endpoint able to trigger unmetered outbound mail — see the follow-ups
 * in `context/current-feature.md`.
 */
export async function requestPasswordReset(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  // A malformed address is safe to reject plainly: it could not belong to an
  // account either way, so the message gives nothing away.
  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true },
  });

  // An account with no password is still eligible. It signed up through GitHub,
  // and following a link sent to its mailbox is the same evidence a reset
  // relies on for everyone else — so this grants it a password rather than
  // leaving a user who has lost their GitHub account with no way back in. The
  // OAuth sign-in keeps working alongside it.
  if (user) {
    try {
      const token = await createPasswordResetToken(email);

      await sendPasswordResetEmail({ to: email, name: user.name, token });
    } catch (error) {
      console.error("Password reset email failed to send", error);
    }
  }

  return { message: ACKNOWLEDGEMENT };
}

export interface ResetPasswordState {
  error?: string;
  /** Field-keyed messages, so the form can mark the offending input. */
  fieldErrors?: Partial<Record<"password" | "confirmPassword", string[]>>;
  /** Set when the link itself is the problem, so the form can offer a new one. */
  tokenInvalid?: boolean;
}

const TOKEN_FAILURE_COPY = {
  expired: "That reset link has expired. Request a new one below.",
  invalid:
    "That reset link is not valid. It may have already been used, or a newer link replaced it. Request a new one below.",
} as const;

/**
 * Sets a new password from a reset link.
 *
 * The token is re-checked here rather than trusted from the page that rendered
 * the form: the page's check is a rendering decision made on a GET, and the
 * link can expire or be superseded between that render and this submit.
 *
 * Live sessions are *not* invalidated. Sessions are JWTs under
 * `session: { strategy: "jwt" }`, so there is no server-side record to delete —
 * revoking them would need a token version on `User` and a check in the `jwt`
 * callback, which is a schema change rather than part of this feature. Anyone
 * already signed in on another device stays signed in until their token
 * expires.
 */
export async function resetPassword(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    // A missing or empty token is not something the user can fix in a field, so
    // it is reported as a bad link rather than as a form error on an input they
    // cannot see.
    if (fieldErrors.token) {
      return {
        error: TOKEN_FAILURE_COPY.invalid,
        tokenInvalid: true,
      };
    }

    return { fieldErrors };
  }

  const result = await resetPasswordWithToken(
    parsed.data.token,
    parsed.data.password,
  );

  if (!result.ok) {
    return {
      error: TOKEN_FAILURE_COPY[result.reason],
      tokenInvalid: true,
    };
  }

  // Nothing to render on success: the next step is signing in, and the sign-in
  // page already knows how to say so.
  redirect("/sign-in?reset=1");
}
