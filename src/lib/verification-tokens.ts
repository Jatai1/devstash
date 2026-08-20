import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/prisma";

/**
 * How long a verification link stays usable.
 *
 * Long enough to survive an email sitting unread overnight, short enough that a
 * link found later in an inbox is no longer a way in.
 */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** 32 bytes of entropy, which base64url encodes to 43 URL-safe characters. */
const TOKEN_BYTES = 32;

/**
 * What goes in the URL is the raw token; what goes in the database is its
 * SHA-256 hash.
 *
 * A verification token is a bearer credential — anyone holding it can verify
 * the address it belongs to — so the table should not contain anything that
 * could be replayed if it leaked. Hashing is unsalted and uses a fast digest on
 * purpose: unlike a password, the input is 32 random bytes, so there is nothing
 * to brute force and nothing for a salt to protect against.
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a fresh verification token for an address and returns the raw value to
 * put in the link.
 *
 * Any earlier tokens for the same address are dropped first, so requesting a
 * new link invalidates the old one rather than leaving several live at once.
 */
export async function createVerificationToken(email: string): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { identifier: email } }),
    prisma.verificationToken.create({
      data: {
        identifier: email,
        token: hashToken(token),
        expires: new Date(Date.now() + TOKEN_TTL_MS),
      },
    }),
  ]);

  return token;
}

/** Why a token could not be used, for the page to render. */
export type VerificationFailure = "invalid" | "expired";

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
  if (!rawToken) {
    return { ok: false, reason: "invalid" };
  }

  const record = await prisma.verificationToken.findUnique({
    where: { token: hashToken(rawToken) },
  });

  if (!record) {
    return { ok: false, reason: "invalid" };
  }

  // The lookup above already matched on the hash, so this only re-checks what
  // the index found. It costs nothing and keeps the comparison constant-time if
  // this ever moves to a scan.
  const expected = Buffer.from(record.token);
  const actual = Buffer.from(hashToken(rawToken));

  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, reason: "invalid" };
  }

  await prisma.verificationToken.delete({ where: { token: record.token } });

  if (record.expires < new Date()) {
    return { ok: false, reason: "expired" };
  }

  await prisma.user.update({
    where: { email: record.identifier },
    data: { emailVerified: new Date() },
  });

  return { ok: true, email: record.identifier };
}
