/**
 * Whether registrations have to confirm their email address.
 *
 * Read this rather than `process.env` directly: registration, the sign-in gate
 * and the resend action all have to agree, and three separate reads of the same
 * variable is three chances to parse it differently.
 *
 * Deliberately **not** `server-only` and **not** `NEXT_PUBLIC_`. The prefix
 * would inline the value into the client bundle at build time, freezing it and
 * publishing it; leaving the guard off keeps the helper usable from scripts,
 * and the failure mode if a client component ever imports it is harmless —
 * `process.env` is empty there, so it reports enabled, which is the safe answer.
 */
const FLAG = "EMAIL_VERIFICATION_ENABLED";

/**
 * Values that turn verification off.
 *
 * Only an explicit, recognizable "no" disables it. Anything else — a typo, an
 * empty string, a stray quote — leaves verification on, so a mistake in
 * configuration fails toward enforcing the check rather than quietly skipping
 * it.
 */
const DISABLED_VALUES = new Set(["false", "0", "off", "no"]);

/**
 * True unless the environment explicitly disables verification.
 *
 * Defaults to enabled so an environment that never sets the variable — a fresh
 * clone, CI, a deploy where someone forgot — behaves exactly as it did before
 * the flag existed.
 */
export function isEmailVerificationEnabled(): boolean {
  const raw = process.env[FLAG];

  if (raw === undefined) {
    return true;
  }

  return !DISABLED_VALUES.has(raw.trim().toLowerCase());
}
