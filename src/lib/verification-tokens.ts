import { prisma } from "@/lib/prisma";
import { claimScopedToken, createScopedToken } from "@/lib/tokens";
import type { TokenFailure } from "@/lib/tokens";

/**
 * How long a verification link stays usable.
 *
 * Long enough to survive an email sitting unread overnight, short enough that a
 * link found later in an inbox is no longer a way in.
 */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Verification rows are stored under the bare address, with no namespace.
 *
 * That is the shape the Auth.js Prisma adapter writes and that
 * `scripts/backfill-email-verified.ts` reads, so it stays as it was when
 * password reset joined the same table. See `src/lib/tokens.ts` for how the two
 * are kept from redeeming each other's links.
 */
const VERIFICATION_NAMESPACE = null;

/**
 * Issues a fresh verification token for an address and returns the raw value to
 * put in the link.
 *
 * Any earlier verification token for the same address is dropped first, so
 * requesting a new link invalidates the old one rather than leaving several
 * live at once. A pending *password reset* token for the same address is left
 * alone — it is scoped separately.
 */
export async function createVerificationToken(email: string): Promise<string> {
  return createScopedToken(VERIFICATION_NAMESPACE, email, TOKEN_TTL_MS);
}

/** Why a token could not be used, for the page to render. */
export type VerificationFailure = TokenFailure;

export type VerificationResult =
  | { ok: true; email: string }
  | { ok: false; reason: VerificationFailure };

/**
 * Consumes a verification token and marks its address verified.
 *
 * The token row is deleted whether or not it had expired, so a link works
 * exactly once and an expired one cannot be retried. Verifying an address that
 * is already verified is treated as success — the common cause is someone
 * clicking the same link twice, and showing them an error for that would be
 * confusing rather than protective.
 */
export async function consumeVerificationToken(
  rawToken: string,
): Promise<VerificationResult> {
  const claim = await claimScopedToken(VERIFICATION_NAMESPACE, rawToken);

  if (!claim.ok) {
    return claim;
  }

  try {
    await prisma.user.update({
      where: { email: claim.email },
      data: { emailVerified: new Date() },
    });
  } catch {
    // `VerificationToken` keys on an email rather than a user id, so nothing
    // removes a token when its account is deleted. A link for an account that
    // no longer exists is indistinguishable from a bad one.
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, email: claim.email };
}
