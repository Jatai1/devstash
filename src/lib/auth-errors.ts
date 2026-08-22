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
/**
 * The `code` an unverified sign-in attempt reports.
 *
 * Lives here rather than in `auth.ts` so the class that throws it and the map
 * that renders it cannot drift, and so `auth.ts` is not imported by anything
 * that only needs the message.
 */
export const EMAIL_NOT_VERIFIED_CODE = "EmailNotVerified";

/**
 * The `code` a rate-limited sign-in attempt reports.
 *
 * Unlike every other credentials failure this one says something true and
 * specific, because it describes the *caller's* own request rate rather than
 * anything about the account. It exists so a direct POST to
 * `/api/auth/callback/credentials` — which never touches the Server Action and
 * so never sees its message — still comes back with something better than
 * "email and password do not match".
 */
export const RATE_LIMITED_CODE = "RateLimited";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "That email and password do not match an account.",

  // Deliberately vaguer than the Server Action's message, which can name the
  // exact wait. A code in a redirect URL cannot carry a number of minutes.
  [RATE_LIMITED_CODE]:
    "Too many sign-in attempts. Please wait a few minutes and try again.",

  [EMAIL_NOT_VERIFIED_CODE]:
    "Please verify your email address before signing in. Check your inbox for the link, or request a new one below.",

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

/** Whether a code has specific text, as opposed to falling back. */
export function hasAuthErrorMessage(code: string | undefined | null): boolean {
  return Boolean(code && code in AUTH_ERROR_MESSAGES);
}

/**
 * Picks the more specific of the two parameters Auth.js puts in the URL.
 *
 * A credentials failure arrives as `error=CredentialsSignin&code=<reason>`.
 * `code` is the specific half, but Auth.js sets it to its own default
 * `"credentials"` for an ordinary rejected sign-in, which has no entry here —
 * so it is only preferred when it actually names something, and `error` carries
 * the rest.
 */
export function resolveAuthErrorCode(
  error: string | undefined,
  code: string | undefined,
): string | undefined {
  return hasAuthErrorMessage(code) ? code : error;
}
