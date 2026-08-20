"use server";

import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { getAuthErrorMessage } from "@/lib/auth-errors";
import { signInSchema } from "@/lib/auth-schemas";

/** Where a successful sign-in lands when nothing else was requested. */
const DEFAULT_REDIRECT = "/dashboard";

export interface SignInState {
  error?: string;
  /** Field-keyed messages, so the form can mark the offending input. */
  fieldErrors?: Partial<Record<"email" | "password", string[]>>;
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
      return { error: getAuthErrorMessage(error.type) };
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
