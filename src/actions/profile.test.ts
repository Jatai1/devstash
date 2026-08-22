import { beforeEach, describe, expect, it, vi } from "vitest";

import { changePassword, deleteAccount } from "@/actions/profile";

/**
 * The three boundaries a Server Action test has to close.
 *
 * `@/auth` is mocked because importing it for real pulls NextAuth, the Prisma
 * adapter and bcrypt into the test; `@/lib/prisma` because these tests are
 * about the action's rules rather than about Postgres; and `@/lib/password`
 * because bcrypt at 12 rounds costs a few hundred milliseconds per call, which
 * is real money across a suite and proves nothing the hashing module's own
 * tests would not.
 *
 * Everything the action decides for itself — session handling, validation,
 * which failure names which field — is exercised for real.
 */
vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    item: { deleteMany: vi.fn() },
    collection: { deleteMany: vi.fn() },
    tag: { deleteMany: vi.fn() },
    itemType: { deleteMany: vi.fn() },
    account: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    verificationToken: { deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/password", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  verifyPassword: vi.fn(),
}));

const { auth, signOut } = await import("@/auth");
const { prisma } = await import("@/lib/prisma");
const { verifyPassword } = await import("@/lib/password");

const USER_ID = "user_1";
const EMAIL = "demo@devstash.io";

/** A resolved session, as `auth()` returns one. */
function signedIn(id: string | null = USER_ID) {
  vi.mocked(auth).mockResolvedValue(
    (id ? { user: { id } } : null) as unknown as never,
  );
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value);
  }

  return data;
}

const VALID_CHANGE = {
  currentPassword: "old password",
  password: "a new password",
  confirmPassword: "a new password",
};

beforeEach(() => {
  signedIn();
  vi.mocked(verifyPassword).mockResolvedValue(true);
  vi.mocked(prisma.user.findUnique).mockResolvedValue({
    password: "stored-hash",
    email: EMAIL,
  } as never);
  vi.mocked(prisma.$transaction).mockResolvedValue([]);
});

describe("changePassword", () => {
  it("refuses when the session does not resolve", async () => {
    // A Server Action is a public endpoint. Being rendered behind the proxy is
    // not authorization, so the action re-derives the user itself.
    signedIn(null);

    expect(await changePassword({}, form(VALID_CHANGE))).toEqual({
      error: "Your session has expired. Sign in again.",
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("refuses when the session names a row that no longer exists", async () => {
    // Reachable rather than defensive: a JWT stays valid until it expires, so
    // it can outlive the account it names.
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    expect(await changePassword({}, form(VALID_CHANGE))).toEqual({
      error: "Your session has expired. Sign in again.",
    });
  });

  it("returns field errors for a new password that breaks the rules", async () => {
    const state = await changePassword(
      {},
      form({ ...VALID_CHANGE, password: "short", confirmPassword: "short" }),
    );

    expect(state.fieldErrors?.password).toBeDefined();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("marks confirmPassword when the two do not match", async () => {
    const state = await changePassword(
      {},
      form({ ...VALID_CHANGE, confirmPassword: "something else" }),
    );

    expect(state.fieldErrors?.confirmPassword).toEqual([
      "Passwords do not match",
    ]);
  });

  it("sends a GitHub-only account to the reset flow", async () => {
    // The form is not rendered for an account with no password, but the action
    // can be called without it, so the rule is enforced here too.
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      password: null,
    } as never);

    const state = await changePassword({}, form(VALID_CHANGE));

    expect(state.error).toMatch(/GitHub/);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("names the current password field when it is wrong", async () => {
    // Safe to name here in a way it is not on the sign-in form: the caller is
    // already authenticated as this account, so it confirms nothing they did
    // not know.
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const state = await changePassword({}, form(VALID_CHANGE));

    expect(state.fieldErrors?.currentPassword).toEqual([
      "That is not your current password",
    ]);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("stores a hash of the new password and reports success", async () => {
    const state = await changePassword({}, form(VALID_CHANGE));

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { password: `hashed:${VALID_CHANGE.password}` },
    });

    expect(state.message).toBe("Your password has been updated.");

    // The form resets itself in an effect, which needs a value that *changes*
    // between two consecutive successes — `message` is the same string every
    // time.
    expect(typeof state.succeededAt).toBe("number");
  });
});

describe("deleteAccount", () => {
  it("refuses when the session does not resolve", async () => {
    signedIn(null);

    expect(await deleteAccount({}, form({ confirmation: EMAIL }))).toEqual({
      error: "Your session has expired. Sign in again.",
    });
  });

  it("refuses when the typed confirmation does not match", async () => {
    // Checked server-side as well as in the dialog, so the guard is real rather
    // than a UI courtesy.
    const state = await deleteAccount({}, form({ confirmation: "nope" }));

    expect(state).toEqual({ error: "That does not match your email address." });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("accepts a confirmation whose case or padding differs", async () => {
    // Addresses are stored lowercase, but a phone keyboard will capitalise the
    // first letter of what was typed. Rejecting that would be a puzzle rather
    // than a safeguard.
    await deleteAccount({}, form({ confirmation: "  Demo@DevStash.io " }));

    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("deletes the account and clears the session cookie", async () => {
    await deleteAccount({}, form({ confirmation: EMAIL }));

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // Items go first: `Item.itemType` is a required relation with no
    // `onDelete`, which Prisma defaults to `Restrict`, so a user's own custom
    // type cannot be removed while their items still reference it.
    expect(prisma.item.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
    expect(prisma.itemType.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });

    // `VerificationToken` has no foreign key to `User`, so nothing cascades and
    // every namespace has to be swept by hand.
    expect(prisma.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: { in: [EMAIL, `password-reset:${EMAIL}`] } },
    });

    // The row is gone but the JWT naming it is still valid, so every page
    // behind the proxy would throw on a session pointing at a missing user.
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/" });
  });

  it("leaves the account whole and stays signed in when the transaction fails", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(new Error("connection"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await deleteAccount({}, form({ confirmation: EMAIL }));

    expect(state).toEqual({
      error: "Could not delete your account just now. Try again.",
    });

    // Signing out on a failed delete would leave the user unable to tell
    // whether it went through.
    expect(signOut).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
  });
});
