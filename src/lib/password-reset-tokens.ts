import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import {
  claimScopedToken,
  createScopedToken,
  peekScopedToken,
} from "@/lib/tokens";
import type { TokenFailure } from "@/lib/tokens";

/**
 * How long a reset link stays usable.
 *
 * Much shorter than the 24 hours a verification link gets: this one can change
 * a credential rather than just confirm an address, so the window in which a
 * leaked or forwarded message is still a way in should be small. An hour is
 * long enough to find the mail and act on it.
 */
const TOKEN_TTL_MS = 60 * 60 * 1000;

/**
 * Reset rows are namespaced, unlike verification rows which use the bare
 * address. `src/lib/tokens.ts` explains what that separation buys.
 */
const RESET_NAMESPACE = "password-reset" as const;

/** Issues a reset token and returns the raw value to put in the link. */
export async function createPasswordResetToken(email: string): Promise<string> {
  return createScopedToken(RESET_NAMESPACE, email, TOKEN_TTL_MS);
}

export type PasswordResetFailure = TokenFailure;

export type PasswordResetTokenCheck =
  | { ok: true; email: string }
  | { ok: false; reason: PasswordResetFailure };

/**
 * Checks a reset link without spending it, so the page can decide between the
 * password form and a failure message.
 *
 * A token that passes here can still fail at submit — it may expire in between,
 * or be superseded by a newer request — so this is a rendering decision, never
 * an authorization one.
 */
export async function checkPasswordResetToken(
  rawToken: string,
): Promise<PasswordResetTokenCheck> {
  return peekScopedToken(RESET_NAMESPACE, rawToken);
}

export type PasswordResetResult =
  | { ok: true; email: string }
  | { ok: false; reason: PasswordResetFailure };

/**
 * Spends a reset token and writes the new password.
 *
 * The ordering here is deliberate on both ends. The token is checked *before*
 * bcrypt runs, because hashing at 12 rounds costs a few hundred milliseconds of
 * CPU and this endpoint takes an arbitrary string from anyone — hashing first
 * would let a caller spend that on any random token. It is then claimed *after*
 * the hash is ready, so the gap between the link being spent and the password
 * being written is a single statement rather than the whole bcrypt run.
 *
 * The address is also stamped verified. Following a link sent to the mailbox is
 * the same evidence email verification asks for, and leaving it unstamped would
 * let someone prove control of their address and still be refused at sign-in.
 */
export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string,
): Promise<PasswordResetResult> {
  const precheck = await peekScopedToken(RESET_NAMESPACE, rawToken);

  if (!precheck.ok) {
    return precheck;
  }

  const hashed = await hashPassword(newPassword);

  // Claimed rather than trusting the pre-check: the delete is what decides the
  // race between two concurrent submits, and the link can be spent, superseded
  // or expired while bcrypt is running.
  const claim = await claimScopedToken(RESET_NAMESPACE, rawToken);

  if (!claim.ok) {
    return claim;
  }

  try {
    // One transaction, because the two writes must not come apart: a password
    // changed without the stamp would leave an account that cannot sign in
    // while email verification is enabled. The second write is conditional on
    // `emailVerified: null` so an account that verified months ago keeps the
    // date it actually verified on rather than having it rewritten to today by
    // an unrelated password change — `updateMany` is what allows that
    // condition, while the `update` is the one that has to find a row.
    await prisma.$transaction([
      prisma.user.update({
        where: { email: claim.email },
        data: { password: hashed },
      }),
      prisma.user.updateMany({
        where: { email: claim.email, emailVerified: null },
        data: { emailVerified: new Date() },
      }),
    ]);
  } catch {
    // Nothing removes a token when its account is deleted — the table keys on
    // an email, not a user id — so a link for an account that no longer exists
    // is indistinguishable from a bad one.
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, email: claim.email };
}
