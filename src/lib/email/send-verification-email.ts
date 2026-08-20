import "server-only";

import { EMAIL_FROM, getBaseUrl, getResend } from "@/lib/email/client";

interface SendVerificationEmailArgs {
  to: string;
  /** Shown in the greeting; falls back to the address when unset. */
  name?: string | null;
  /** The raw token from `createVerificationToken`. */
  token: string;
}

/** Builds the link a recipient clicks. Exported so tests can assert on it. */
export function buildVerificationUrl(token: string): string {
  const url = new URL("/verify-email", getBaseUrl());

  url.searchParams.set("token", token);

  return url.toString();
}

function renderHtml(verificationUrl: string, greetingName: string): string {
  // Deliberately plain, table-free HTML with inline styles: mail clients strip
  // <style> blocks and support almost no modern CSS, so nothing here relies on
  // the app's Tailwind theme.
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">Verify your email</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
        Hi ${greetingName}, confirm this address to finish setting up your Devstash account.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${verificationUrl}"
           style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:500;">
          Verify email
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#52525b;">
        Or paste this link into your browser:
      </p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;color:#52525b;">
        ${verificationUrl}
      </p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
        This link expires in 24 hours. If you did not create a Devstash account, you can ignore this email.
      </p>
    </div>
  </body>
</html>`;
}

function renderText(verificationUrl: string, greetingName: string): string {
  return [
    `Hi ${greetingName},`,
    "",
    "Confirm this address to finish setting up your Devstash account:",
    verificationUrl,
    "",
    "This link expires in 24 hours.",
    "If you did not create a Devstash account, you can ignore this email.",
  ].join("\n");
}

/**
 * Sends the verification link.
 *
 * Throws on failure rather than swallowing it, so the caller decides what a
 * failed send means — the register route needs to tell the user their account
 * exists but the mail did not arrive, which it can only do if it hears about
 * the failure.
 */
export async function sendVerificationEmail({
  to,
  name,
  token,
}: SendVerificationEmailArgs): Promise<void> {
  const verificationUrl = buildVerificationUrl(token);
  const greetingName = name?.trim() || to;

  // Resend reports failures in the resolved `error` field rather than by
  // rejecting, so an unchecked `await` here would look like a successful send.
  const { error } = await getResend().emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Verify your email for Devstash",
    html: renderHtml(verificationUrl, greetingName),
    // Some clients and most spam filters prefer a multipart message; sending
    // HTML alone is a deliverability penalty for no benefit.
    text: renderText(verificationUrl, greetingName),
  });

  if (error) {
    throw new Error(`Resend rejected the message: ${error.message}`);
  }
}
