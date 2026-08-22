import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  changePasswordSchema,
  registerSchema,
  signInSchema,
} from "@/lib/auth-schemas";

const VALID_REGISTRATION = {
  name: "Demo User",
  email: "demo@devstash.io",
  password: "correct horse",
  confirmPassword: "correct horse",
};

describe("registerSchema", () => {
  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse(VALID_REGISTRATION).success).toBe(true);
  });

  it("normalizes the email to lowercase", () => {
    // Postgres unique indexes are case-sensitive, so the address has to be
    // lowered before it reaches the database or two rows could hold what a user
    // considers one account.
    const parsed = registerSchema.parse({
      ...VALID_REGISTRATION,
      email: "Demo@DevStash.IO",
    });

    expect(parsed.email).toBe("demo@devstash.io");
  });

  it("trims the name and rejects one that is only whitespace", () => {
    expect(
      registerSchema.parse({ ...VALID_REGISTRATION, name: "  Demo User  " })
        .name,
    ).toBe("Demo User");

    expect(
      registerSchema.safeParse({ ...VALID_REGISTRATION, name: "   " }).success,
    ).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const parsed = registerSchema.safeParse({
      ...VALID_REGISTRATION,
      password: "1234567",
      confirmPassword: "1234567",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a password over 72 bytes even when it is short in characters", () => {
    // The rule that this test exists for: bcrypt hashes only the first 72
    // *bytes* and silently drops the rest, so 72 emoji (288 bytes) would be
    // truncated to a fraction of their entropy. A `.max()` on characters would
    // wave this through.
    const emoji = "🔒".repeat(72);

    expect(emoji.length).toBeLessThan(72 * 4);
    expect(new TextEncoder().encode(emoji).length).toBeGreaterThan(72);

    const parsed = registerSchema.safeParse({
      ...VALID_REGISTRATION,
      password: emoji,
      confirmPassword: emoji,
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a password that is exactly 72 bytes", () => {
    const password = "a".repeat(72);

    expect(
      registerSchema.safeParse({
        ...VALID_REGISTRATION,
        password,
        confirmPassword: password,
      }).success,
    ).toBe(true);
  });

  it("reports a mismatch against confirmPassword, so the form marks that field", () => {
    const parsed = registerSchema.safeParse({
      ...VALID_REGISTRATION,
      confirmPassword: "something else",
    });

    expect(parsed.success).toBe(false);

    if (parsed.success) return;

    // `z.flattenError` is the Zod 4 spelling the actions use to build their
    // `fieldErrors`, so the test asserts on the shape a form actually receives.
    const { fieldErrors } = z.flattenError(parsed.error);

    expect(fieldErrors.confirmPassword).toEqual(["Passwords do not match"]);
    expect(fieldErrors.password).toBeUndefined();
  });
});

describe("signInSchema", () => {
  it("accepts any non-empty password", () => {
    // Deliberately looser than `registerSchema`: sign-in only has to recognize
    // a password that was already accepted, and applying today's rules here
    // would lock out anyone who signed up under older ones.
    expect(
      signInSchema.safeParse({ email: "demo@devstash.io", password: "old" })
        .success,
    ).toBe(true);
  });

  it("rejects an empty password and a malformed address", () => {
    expect(
      signInSchema.safeParse({ email: "demo@devstash.io", password: "" })
        .success,
    ).toBe(false);

    expect(
      signInSchema.safeParse({ email: "not-an-email", password: "whatever" })
        .success,
    ).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("only checks the current password for presence", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "x",
        password: "a new password",
        confirmPassword: "a new password",
      }).success,
    ).toBe(true);
  });

  it("holds the new password to the registration rules", () => {
    // The two set the same column, so a reset or a change must not be able to
    // install a password registration would have refused.
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old password",
        password: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
  });
});
