/**
 * Human-readable text for the error codes Auth.js reports.
 *
 * Auth.js signals failure in two places and both land here: `signIn` throws an
 * `AuthError` whose `type` is one of these, and a failure during a provider
 * redirect comes back as `/sign-in?error=<code>`.
 *
 * The generic fallback is the important entry — `CredentialsSignin` covers both
 * "no such account" and "wrong password", and phase 2 kept them
 * indistinguishable on purpose so the form cannot be used to discover which
 * emails are registered.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "That email and password do not match an account.",

  // The account exists with this email but was created another way, and
  // Auth.js will not link the two automatically. That default is worth
  // keeping: auto-linking on an unverified email lets anyone who can get a
  // provider to vouch for an address take over the account behind it.
  OAuthAccountNotLinked:
    "An account with that email already exists. Sign in with your password instead, or use the provider you originally signed up with.",

  OAuthSignin: "Could not reach the sign-in provider. Try again.",
  OAuthCallback: "The sign-in provider rejected the request. Try again.",
  OAuthCreateAccount: "Could not create an account from that provider.",
  AccessDenied: "You do not have access to this application.",
  Verification: "That sign-in link has expired or was already used.",
};

const FALLBACK_MESSAGE = "Something went wrong signing you in. Try again.";

/** Maps an Auth.js error code to text worth showing a user. */
export function getAuthErrorMessage(code: string | undefined | null): string {
  if (!code) {
    return FALLBACK_MESSAGE;
  }

  return AUTH_ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE;
}
