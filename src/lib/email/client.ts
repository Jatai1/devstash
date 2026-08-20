import "server-only";

import { Resend } from "resend";

/**
 * The address verification mail is sent from.
 *
 * Resend will only send from a domain the account has verified. `onboarding@
 * resend.dev` is its shared sandbox sender, which works without any DNS setup
 * but can only deliver to the address that owns the Resend account (and to
 * Resend's own `*@resend.dev` test inboxes). Set `EMAIL_FROM` to an address on
 * a verified domain before this reaches real users.
 */
export const EMAIL_FROM = process.env.EMAIL_FROM ?? "onboarding@resend.dev";

/**
 * Absolute origin for links in outgoing mail.
 *
 * Email cannot follow a relative URL, so this cannot be derived from the
 * request the way in-app redirects are. `AUTH_URL` is the variable Auth.js
 * already defines; `VERCEL_URL` covers preview deployments, where the host is
 * assigned per deployment and is not known ahead of time.
 */
export function getBaseUrl(): string {
  if (process.env.AUTH_URL) {
    return process.env.AUTH_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

let client: Resend | null = null;

/**
 * The Resend client, created on first use.
 *
 * Not created at module load: `RESEND_API_KEY` is missing in some environments
 * (a bare `next build`, CI) and constructing eagerly would fail the import for
 * every route that transitively reaches this file, the same way an eager
 * `env()` call once broke `prisma.config.ts` during Vercel's postinstall.
 */
export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set — verification email cannot be sent.",
    );
  }

  client ??= new Resend(apiKey);

  return client;
}
