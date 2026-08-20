"use server";

import { AuthError, CredentialsSignin } from "next-auth";

import { signIn, signOut } from "@/auth";
import { EMAIL_NOT_VERIFIED_CODE, getAuthErrorMessage } from "@/lib/auth-errors";
import { resendVerificationSchema, signInSchema } from "@/lib/auth-schemas";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import { prisma } from "@/lib/prisma";
import { createVerificationToken } from "@/lib/verification-tokens";

/** Where a successful sign-in lands when nothing else was requested. */
const DEFAULT_REDIRECT = "/dashboard";

export interface SignInState {
  error?: string;
  /** Field-keyed messages, so the form can mark the offending input. */
  fieldErrors?: Partial<Record<"email" | "password", string[]>>;
  /** Drives the "resend the link" affordance, shown only when it would help. */
  emailNotVerified?: boolean;
}

/**
 * Only same-origin paths are accepted as a redirect target.
 *
 * `callbackUrl` arrives in the query string, so without this check any link to
 * `/sign-in?callbackUrl=https://example.com` would bounce a freshly
 * authenticated user off-site.
 */
function safeRedirect(callbackUrl: string | undefined): string {
  if (!callbackUrl?.startsWith("/") || callbackUrl.startsWith("//")) {
    return DEFAULT_REDIRECT;
  }

  return callbackUrl;
}

/**
 * Signs in with an email and password.
 *
 * Shaped for `useActionState`, so the returned state is what the form renders.
 * On success nothing is returned at all: `signIn` throws a redirect, which
 * Next.js catches upstream.
 */
export async function signInWithCredentials(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      // Deliberately not "no account with that email": the same message covers
      // a malformed address and a wrong password, so neither reveals which
      // emails are registered.
      error: getAuthErrorMessage("CredentialsSignin"),
    };
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeRedirect(formData.get("callbackUrl")?.toString()),
    });
  } catch (error) {
    // `signIn` reports failure by throwing. An `AuthError` is a rejected
    // sign-in and belongs on the form; anything else — including the redirect
    // Next.js throws on success — has to keep propagating.
    if (error instanceof AuthError) {
      // A `CredentialsSignin` subclass carries the specific reason on `code`,
      // while `type` stays the generic "CredentialsSignin" for all of them —
      // so reading `type` alone would flatten "unverified" into "wrong
      // password". `code` is only set by our own thrown errors.
      const code =
        error instanceof CredentialsSignin ? error.code : error.type;

      return {
        error: getAuthErrorMessage(code),
        emailNotVerified: code === EMAIL_NOT_VERIFIED_CODE,
      };
    }

    throw error;
  }

  return {};
}

/** Starts the GitHub OAuth round trip. */
export async function signInWithGitHub(formData: FormData): Promise<void> {
  await signIn("github", {
    redirectTo: safeRedirect(formData.get("callbackUrl")?.toString()),
  });
}

/** Ends the session and returns the user to the sign-in page. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/sign-in" });
}

export interface ResendState {
  /** Rendered as-is; identical for every outcome. See below. */
  message?: string;
  error?: string;
}

/**
 * What the caller is told regardless of what actually happened.
 *
 * An unknown address, an already-verified account and a real send all produce
 * this one sentence. Saying "no account with that email" or "already verified"
 * would turn an unauthenticated endpoint into a way to test which addresses are
 * registered — the same reasoning that keeps `authorize` vague, and the reason
 * this is worded as what *will* happen rather than what did.
 */
const RESEND_ACKNOWLEDGEMENT =
  "If that address has an unverified account, a new verification link is on its way.";

/**
 * Issues a fresh verification link.
 *
 * Rate limiting is deliberately out of scope for this feature, which leaves
 * this endpoint able to trigger unmetered outbound mail — see the follow-ups in
 * `context/current-feature.md`.
 */
export async function resendVerificationEmail(
  _previous: ResendState,
  formData: FormData,
): Promise<ResendState> {
  const parsed = resendVerificationSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const { email } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, emailVerified: true, password: true },
  });

  // Nothing to do for an unknown address, an already-verified one, or an
  // OAuth-only account that has no password and never needed to verify — but
  // all three return the same acknowledgement as a successful send.
  if (!user || user.emailVerified || !user.password) {
    return { message: RESEND_ACKNOWLEDGEMENT };
  }

  try {
    const token = await createVerificationToken(email);

    await sendVerificationEmail({ to: email, name: user.name, token });
  } catch (error) {
    // A send failure is the one case worth reporting honestly: the address is
    // already known to exist, so saying so reveals nothing further, and
    // pretending it worked would leave the user waiting for mail that is not
    // coming.
    console.error("Verification email failed to resend", error);

    return { error: "Could not send the email just now. Try again shortly." };
  }

  return { message: RESEND_ACKNOWLEDGEMENT };
}
