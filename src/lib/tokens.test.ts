import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  claimScopedToken,
  createScopedToken,
  peekScopedToken,
  tokenIdentifiersFor,
} from "@/lib/tokens";

/**
 * The database is mocked rather than reached.
 *
 * These tests are about the rules the module enforces — how an identifier is
 * namespaced, what is stored versus what goes in the link, and which failures
 * consume a row — none of which need a live Postgres to observe. `npm run
 * test:db` is what exercises the real connection.
 */
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    verificationToken: {
      create: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

const { prisma } = await import("@/lib/prisma");

const verificationToken = vi.mocked(prisma.verificationToken);

const EMAIL = "demo@devstash.io";

const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** A stored row as `findUnique` would return it. */
function row(identifier: string, rawToken: string, expires: Date) {
  return { identifier, token: sha256(rawToken), expires };
}

const IN_AN_HOUR = () => new Date(Date.now() + 60 * 60 * 1000);
const AN_HOUR_AGO = () => new Date(Date.now() - 60 * 60 * 1000);

beforeEach(() => {
  vi.mocked(prisma.$transaction).mockResolvedValue([]);
  verificationToken.deleteMany.mockResolvedValue({ count: 1 });
});

describe("tokenIdentifiersFor", () => {
  it("covers the bare address and every namespace", () => {
    // Anything deleting a user has to sweep all of these: `VerificationToken`
    // keys on the address and has no foreign key to `User`, so nothing cascades
    // and a sweep that matched only the bare email would orphan the rest.
    expect(tokenIdentifiersFor(EMAIL)).toEqual([
      EMAIL,
      `password-reset:${EMAIL}`,
    ]);
  });
});

describe("createScopedToken", () => {
  it("returns a raw token that is not what gets stored", async () => {
    const raw = await createScopedToken(null, EMAIL, 60_000);

    // 32 random bytes, base64url encoded.
    expect(raw).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const { data } = verificationToken.create.mock.calls[0][0];

    // The row holds the digest. A leaked table should not hand anyone a
    // working link.
    expect(data.token).toBe(sha256(raw));
    expect(data.token).not.toBe(raw);
  });

  it("stores an email-verification token under the bare address", async () => {
    await createScopedToken(null, EMAIL, 60_000);

    expect(verificationToken.create.mock.calls[0][0].data.identifier).toBe(
      EMAIL,
    );
  });

  it("namespaces a password-reset token", async () => {
    await createScopedToken("password-reset", EMAIL, 60_000);

    expect(verificationToken.create.mock.calls[0][0].data.identifier).toBe(
      `password-reset:${EMAIL}`,
    );
  });

  it("supersedes only the same namespace's earlier tokens", async () => {
    await createScopedToken("password-reset", EMAIL, 60_000);

    // Scoping the delete is what lets a pending verification link and a pending
    // reset link coexist for one address instead of cancelling each other.
    expect(verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: `password-reset:${EMAIL}` },
    });
  });

  it("expires the row at now plus the ttl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00Z"));

    await createScopedToken(null, EMAIL, 60 * 60 * 1000);

    expect(
      verificationToken.create.mock.calls[0][0].data.expires,
    ).toStrictEqual(new Date("2026-01-15T13:00:00Z"));

    vi.useRealTimers();
  });
});

describe("peekScopedToken", () => {
  it("reports an empty or unknown token as invalid", async () => {
    expect(await peekScopedToken(null, "")).toEqual({
      ok: false,
      reason: "invalid",
    });

    verificationToken.findUnique.mockResolvedValue(null);

    expect(await peekScopedToken(null, "nope")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("returns the address for a live token", async () => {
    verificationToken.findUnique.mockResolvedValue(
      row(EMAIL, "raw", IN_AN_HOUR()),
    );

    expect(await peekScopedToken(null, "raw")).toEqual({
      ok: true,
      email: EMAIL,
    });
  });

  it("does not consume the row", async () => {
    verificationToken.findUnique.mockResolvedValue(
      row(EMAIL, "raw", IN_AN_HOUR()),
    );

    await peekScopedToken(null, "raw");

    // The reset page peeks to decide whether to render a password form. Burning
    // the token on that GET would mean the form it just rendered could never be
    // submitted.
    expect(verificationToken.deleteMany).not.toHaveBeenCalled();
  });

  it("reports an expired token as expired rather than invalid", async () => {
    verificationToken.findUnique.mockResolvedValue(
      row(EMAIL, "raw", AN_HOUR_AGO()),
    );

    expect(await peekScopedToken(null, "raw")).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("refuses a token belonging to another namespace", async () => {
    // A password-reset row presented at `/verify-email`. Without the namespace
    // check either token would be redeemable by the other flow — and a
    // verification link, issued to anyone who types an address into the
    // register form, would be enough to set a password.
    verificationToken.findUnique.mockResolvedValue(
      row(`password-reset:${EMAIL}`, "raw", IN_AN_HOUR()),
    );

    expect(await peekScopedToken(null, "raw")).toEqual({
      ok: false,
      reason: "invalid",
    });

    // And the reverse: a verification row presented at `/reset-password`.
    verificationToken.findUnique.mockResolvedValue(
      row(EMAIL, "raw", IN_AN_HOUR()),
    );

    expect(await peekScopedToken("password-reset", "raw")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });
});

describe("claimScopedToken", () => {
  it("consumes the row and returns the address", async () => {
    verificationToken.findUnique.mockResolvedValue(
      row(`password-reset:${EMAIL}`, "raw", IN_AN_HOUR()),
    );

    expect(await claimScopedToken("password-reset", "raw")).toEqual({
      ok: true,
      email: EMAIL,
    });

    expect(verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { token: sha256("raw") },
    });
  });

  it("loses a race to a concurrent claim", async () => {
    // Both callers find the row, but only one delete affects one. Mail-client
    // link prefetching and security scanners make this real rather than
    // theoretical.
    verificationToken.findUnique.mockResolvedValue(
      row(EMAIL, "raw", IN_AN_HOUR()),
    );
    verificationToken.deleteMany.mockResolvedValue({ count: 0 });

    expect(await claimScopedToken(null, "raw")).toEqual({
      ok: false,
      reason: "invalid",
    });
  });

  it("burns an expired token so it cannot be retried", async () => {
    verificationToken.findUnique.mockResolvedValue(
      row(EMAIL, "raw", AN_HOUR_AGO()),
    );

    expect(await claimScopedToken(null, "raw")).toEqual({
      ok: false,
      reason: "expired",
    });

    expect(verificationToken.deleteMany).toHaveBeenCalled();
  });

  it("rejects another namespace's token without deleting it", async () => {
    verificationToken.findUnique.mockResolvedValue(
      row(`password-reset:${EMAIL}`, "raw", IN_AN_HOUR()),
    );

    expect(await claimScopedToken(null, "raw")).toEqual({
      ok: false,
      reason: "invalid",
    });

    // It is not this caller's row to consume — burning it would let a request
    // to one endpoint invalidate the other flow's live link.
    expect(verificationToken.deleteMany).not.toHaveBeenCalled();
  });
});
