import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

/** 32 bytes of entropy, which base64url encodes to 43 URL-safe characters. */
const TOKEN_BYTES = 32;

/**
 * Separates a namespace from the address it scopes.
 *
 * A colon cannot appear in any address `z.email()` accepts, so a stored
 * identifier containing one is unambiguously namespaced and one without it is
 * unambiguously a bare email.
 */
const SEPARATOR = ":";

/**
 * The purposes a token in `VerificationToken` can serve.
 *
 * `null` is email verification, whose identifier is the bare address. It stays
 * unprefixed because the Auth.js Prisma adapter writes rows in that shape and
 * `scripts/backfill-email-verified.ts` reads them that way.
 */
export type TokenNamespace = "password-reset";

/**
 * Every namespace, as a `Record` keyed by the union rather than a plain array.
 *
 * Anything sweeping an address's tokens has to cover all of them or it leaves
 * orphans, and a missing entry in an array would be silent. Keyed this way,
 * adding a member to `TokenNamespace` without listing it here fails to compile.
 */
const NAMESPACES: Record<TokenNamespace, true> = { "password-reset": true };

/**
 * What goes in the URL is the raw token; what goes in the database is its
 * SHA-256 hash.
 *
 * These tokens are bearer credentials — anyone holding one can act on the
 * address it belongs to — so the table should not contain anything replayable
 * if it leaked. Hashing is unsalted and uses a fast digest on purpose: unlike a
 * password, the input is 32 random bytes, so there is nothing to brute force
 * and nothing for a salt to protect against.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** The identifier a row is stored under. */
function scope(namespace: TokenNamespace | null, email: string): string {
  return namespace === null ? email : `${namespace}${SEPARATOR}${email}`;
}

/**
 * Recovers the address from a stored identifier, or `null` when the row belongs
 * to a different purpose than the caller is claiming for.
 *
 * This is the check that keeps the two flows apart in one table: a password
 * reset link presented at `/verify-email` finds its row but fails to unscope,
 * and a verification link presented at `/reset-password` does the same. Without
 * it, either token would be redeemable by the other flow — and a verification
 * link, which is issued to anyone who types an address into the register form,
 * would be enough to set a password.
 */
function unscope(
  namespace: TokenNamespace | null,
  identifier: string,
): string | null {
  if (namespace === null) {
    return identifier.includes(SEPARATOR) ? null : identifier;
  }

  const prefix = `${namespace}${SEPARATOR}`;

  return identifier.startsWith(prefix) ? identifier.slice(prefix.length) : null;
}

/**
 * Every identifier an address can have tokens stored under, across all
 * namespaces.
 *
 * `VerificationToken` has no foreign key to `User` — it keys on the address —
 * so nothing cascades when an account is deleted. Anything removing a user has
 * to clean these up itself, and matching on the bare email alone would miss the
 * namespaced rows.
 */
export function tokenIdentifiersFor(email: string): string[] {
  const namespaces = Object.keys(NAMESPACES) as TokenNamespace[];

  return [email, ...namespaces.map((namespace) => scope(namespace, email))];
}

/**
 * Issues a token for an address and returns the raw value to put in a link.
 *
 * Earlier tokens *in the same namespace* are dropped first, so requesting a new
 * link supersedes the old one. Scoping the delete is what lets a pending
 * verification link and a pending reset link coexist for one address instead of
 * silently cancelling each other.
 */
export async function createScopedToken(
  namespace: TokenNamespace | null,
  email: string,
  ttlMs: number,
): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const identifier = scope(namespace, email);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier } }),
    prisma.verificationToken.create({
      data: {
        identifier,
        token: hashToken(token),
        expires: new Date(Date.now() + ttlMs),
      },
    }),
  ]);

  return token;
}

/** Why a token could not be used. */
export type TokenFailure = "invalid" | "expired";

export type TokenResult =
  | { ok: true; email: string }
  | { ok: false; reason: TokenFailure };

/**
 * Reads a token without consuming it, for pages that have to decide what to
 * render before the user acts.
 *
 * Deliberately non-mutating: the reset page checks a link is live before
 * showing a password form, and burning the token on that first GET would mean
 * the form it just rendered could never be submitted. The token is required
 * again at submit, where it is consumed for real.
 */
export async function peekScopedToken(
  namespace: TokenNamespace | null,
  rawToken: string,
): Promise<TokenResult> {
  if (!rawToken) {
    return { ok: false, reason: "invalid" };
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(rawToken) },
  });

  if (!record) {
    return { ok: false, reason: "invalid" };
  }

  const email = unscope(namespace, record.identifier);

  if (email === null) {
    return { ok: false, reason: "invalid" };
  }

  if (record.expires < new Date()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, email };
}

/**
 * Consumes a token, returning the address it was issued to.
 *
 * The row is deleted whether or not it had expired, so a link works exactly
 * once and an expired one cannot be retried. The delete is also what decides
 * the race: two concurrent claims both find the row, but only one delete
 * affects a row, and the loser reports an invalid token. Link prefetching in
 * mail clients and security scanners makes that race real rather than
 * theoretical.
 *
 * A token from another namespace is rejected *without* being deleted — it is
 * not this caller's to consume, and burning it would let a request to one
 * endpoint invalidate the other flow's live link.
 */
export async function claimScopedToken(
  namespace: TokenNamespace | null,
  rawToken: string,
): Promise<TokenResult> {
  if (!rawToken) {
    return { ok: false, reason: "invalid" };
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(rawToken) },
  });

  if (!record) {
    return { ok: false, reason: "invalid" };
  }

  const email = unscope(namespace, record.identifier);

  if (email === null) {
    return { ok: false, reason: "invalid" };
  }

  const { count } = await prisma.verificationToken.deleteMany({
    where: { token: record.token },
  });

  if (count === 0) {
    return { ok: false, reason: "invalid" };
  }

  if (record.expires < new Date()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, email };
}
