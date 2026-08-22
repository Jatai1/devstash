import { describe, expect, it } from "vitest";

import {
  EMAIL_NOT_VERIFIED_CODE,
  RATE_LIMITED_CODE,
  getAuthErrorMessage,
  hasAuthErrorMessage,
  resolveAuthErrorCode,
} from "@/lib/auth-errors";

describe("getAuthErrorMessage", () => {
  it("falls back for an unknown code", () => {
    expect(getAuthErrorMessage("SomethingNew")).toBe(
      "Something went wrong signing you in. Try again.",
    );
  });

  it("falls back when there is no code at all", () => {
    expect(getAuthErrorMessage(undefined)).toBe(
      "Something went wrong signing you in. Try again.",
    );
    expect(getAuthErrorMessage(null)).toBe(
      "Something went wrong signing you in. Try again.",
    );
  });

  it("keeps the credentials message vague", () => {
    // Deliberate: "no such account" and "wrong password" are indistinguishable
    // so the sign-in form cannot be used to discover which emails are
    // registered. A message that named either would undo that.
    const message = getAuthErrorMessage("CredentialsSignin");

    expect(message).toBe("That email and password do not match an account.");
    expect(message).not.toMatch(/password is|no account|not registered/i);
  });
});

describe("hasAuthErrorMessage", () => {
  it("is false for an unmapped or missing code", () => {
    expect(hasAuthErrorMessage("credentials")).toBe(false);
    expect(hasAuthErrorMessage(undefined)).toBe(false);
    expect(hasAuthErrorMessage("")).toBe(false);
  });

  it("is true for a mapped code", () => {
    expect(hasAuthErrorMessage(EMAIL_NOT_VERIFIED_CODE)).toBe(true);
  });
});

describe("resolveAuthErrorCode", () => {
  it("prefers `code` when it names something specific", () => {
    // An unverified account arrives as
    // `error=CredentialsSignin&code=EmailNotVerified`, and the specific half is
    // the one worth rendering.
    expect(
      resolveAuthErrorCode("CredentialsSignin", EMAIL_NOT_VERIFIED_CODE),
    ).toBe(EMAIL_NOT_VERIFIED_CODE);

    expect(resolveAuthErrorCode("CredentialsSignin", RATE_LIMITED_CODE)).toBe(
      RATE_LIMITED_CODE,
    );
  });

  it("ignores Auth.js's own default `code`", () => {
    // An ordinary rejected sign-in sets `code=credentials`, which has no entry
    // in the message map. Preferring it would render the fallback instead of
    // the credentials message.
    expect(resolveAuthErrorCode("CredentialsSignin", "credentials")).toBe(
      "CredentialsSignin",
    );
  });

  it("falls through to `error` when no code is present", () => {
    expect(resolveAuthErrorCode("OAuthAccountNotLinked", undefined)).toBe(
      "OAuthAccountNotLinked",
    );
  });

  it("returns undefined when neither is present", () => {
    expect(resolveAuthErrorCode(undefined, undefined)).toBeUndefined();
  });
});
