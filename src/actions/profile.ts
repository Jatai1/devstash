"use server";

import { z } from "zod";

import { auth, signOut } from "@/auth";
import { changePasswordSchema } from "@/lib/auth-schemas";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { tokenIdentifiersFor } from "@/lib/tokens";

/**
 * What every action here says when the session does not resolve to a row.
 *
 * A Server Action is an endpoint of its own, so it re-checks the session rather
 * than trusting that the page rendering the form was behind the proxy. The case
 * is also genuinely reachable: a JWT stays valid until it expires, so one can
 * outlive the account it names — including an account this very page deleted.
 */
const NO_SESSION = "Your session has expired. Sign in again.";

/** The signed-in user's id, or null when the session no longer resolves. */
async function currentUserId(): Promise<string | null> {
  const session = await auth();

  return session?.user?.id ?? null;
}

export interface ChangePasswordState {
  /** Shown on success; the form clears itself when this is set. */
  message?: string;
  /**
   * When the success happened, as a timestamp.
   *
   * The form resets itself in an effect, which needs a value that *changes*
   * between two consecutive successes. `message` is the same string every
   * time, so depending on it alone meant a second password change in one page
   * load skipped the reset and left the filled boxes on screen.
   */
  succeededAt?: number;
  error?: string;
  /** Field-keyed messages, so the form can mark the offending input. */
  fieldErrors?: Partial<
    Record<"currentPassword" | "password" | "confirmPassword", string[]>
  >;
}

/**
 * Changes the signed-in user's password in place.
 *
 * The current password is required rather than taken on trust from the session:
 * a session can be an unattended browser or a stolen cookie, and re-proving the
 * password is what stops either from locking the real owner out of their own
 * account. Anyone who cannot supply it is sent to the emailed reset flow
 * instead, which proves control of the mailbox rather than of the session.
 *
 * Unlike the reset flow this does not touch `emailVerified`: the account is
 * already signed in, so there is nothing here to confirm.
 *
 * Live sessions elsewhere are *not* invalidated, for the same reason a reset
 * does not invalidate them — under `session: { strategy: "jwt" }` there is no
 * server-side record to delete. See `resetPassword` in
 * `src/actions/password-reset.ts`.
 */
export async function changePassword(
  _previous: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const userId = await currentUserId();

  if (!userId) {
    return { error: NO_SESSION };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });

  if (!user) {
    return { error: NO_SESSION };
  }

  // The form is not rendered for a GitHub-only account, but the action can be
  // called without it, so the rule is enforced here too. Such an account cannot
  // set a first password this way — there is no current password to prove — and
  // the reset flow is the deliberate route in, which is where the message
  // points.
  if (!user.password) {
    return {
      error:
        "This account signs in with GitHub and has no password. Use the reset link to set one.",
    };
  }

  if (!(await verifyPassword(parsed.data.currentPassword, user.password))) {
    // Naming the wrong field is safe here in a way it is not on the sign-in
    // form: the caller is already authenticated as this account, so this
    // confirms nothing they did not already know.
    return {
      fieldErrors: { currentPassword: ["That is not your current password"] },
    };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { password: await hashPassword(parsed.data.password) },
  });

  return {
    message: "Your password has been updated.",
    succeededAt: Date.now(),
  };
}

export interface DeleteAccountState {
  error?: string;
}

/**
 * Permanently deletes the signed-in user and everything they own.
 *
 * The typed confirmation is checked server-side as well as in the dialog, so
 * the guard is real rather than a UI courtesy — this is irreversible and
 * cascades through every item, collection and tag the account owns.
 */
export async function deleteAccount(
  _previous: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const userId = await currentUserId();

  if (!userId) {
    return { error: NO_SESSION };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    return { error: NO_SESSION };
  }

  const confirmation = formData.get("confirmation")?.toString().trim() ?? "";

  // Compared case-insensitively: addresses are stored lowercase, but a browser
  // or phone keyboard may capitalise the first letter of what was typed, and
  // rejecting that would be a puzzle rather than a safeguard.
  if (
    !user.email ||
    confirmation.toLowerCase() !== user.email.toLowerCase()
  ) {
    return { error: "That does not match your email address." };
  }

  try {
    await purgeUser(userId, user.email);
  } catch (error) {
    // The transaction is atomic, so a failure here leaves the account whole
    // rather than half-deleted. Reported rather than thrown: an error boundary
    // would leave the user unable to tell whether it went through.
    console.error("Account deletion failed", error);

    return { error: "Could not delete your account just now. Try again." };
  }

  // Outside the `try`, because `signOut` reports success by *throwing* a
  // redirect — catching that would swallow the navigation and leave the browser
  // holding a cookie for a user that no longer exists.
  //
  // Clearing it matters: the row is gone but the JWT naming it is still valid,
  // so every page behind the proxy would throw on a session pointing at a
  // missing user.
  await signOut({ redirectTo: "/" });

  return {};
}

/**
 * Deletes a user and everything they own, in dependency order.
 *
 * Explicit rather than leaning on `user.delete()`'s cascade, matching
 * `scripts/prune-users.ts`. Every relation off `User` does cascade, but
 * `Item.itemType` is a required relation with no `onDelete`, which Prisma
 * defaults to `Restrict` — so a user's own custom item type cannot be removed
 * while their items still reference it. Items go first, which releases that
 * reference; `ItemTag` and `ItemCollection` cascade from `Item` and
 * `Collection`.
 *
 * One transaction, so a failure part-way through cannot leave an account
 * stripped of its contents but still able to sign in.
 */
async function purgeUser(userId: string, email: string | null): Promise<void> {
  const owned = { userId };

  await prisma.$transaction([
    prisma.item.deleteMany({ where: owned }),
    prisma.collection.deleteMany({ where: owned }),
    prisma.tag.deleteMany({ where: owned }),

    // Only the user's own custom types. System types have `userId: null`, which
    // an equality filter never matches, so they are excluded by construction.
    prisma.itemType.deleteMany({ where: owned }),

    // These would cascade from the user, but deleting them here keeps every
    // table this touches visible in one place.
    prisma.account.deleteMany({ where: owned }),
    prisma.session.deleteMany({ where: owned }),

    // `VerificationToken` keys on the email address and has no foreign key to
    // `User`, so nothing removes these when the account goes. All namespaces
    // are swept, not just the bare address, or a pending reset row would be
    // left behind as an orphan.
    ...(email
      ? [
          prisma.verificationToken.deleteMany({
            where: { identifier: { in: tokenIdentifiersFor(email) } },
          }),
        ]
      : []),

    prisma.user.delete({ where: { id: userId } }),
  ]);
}
