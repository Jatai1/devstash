import "server-only";

import { EMAIL_FROM, getBaseUrl, getResend } from "@/lib/email/client";

interface SendPasswordResetEmailArgs {
  to: string;
  /** Shown in the greeting; falls back to the address when unset. */
  name?: string | null;
  /** The raw token from `createPasswordResetToken`. */
  token: string;
}

/** Builds the link a recipient clicks. Exported so tests can assert on it. */
export function buildPasswordResetUrl(token: string): string {
  const url = new URL("/reset-password", getBaseUrl());

  url.searchParams.set("token", token);

  return url.toString();
}

function renderHtml(resetUrl: string, greetingName: string): string {
  // Deliberately plain, table-free HTML with inline styles: mail clients strip
  // <style> blocks and support almost no modern CSS, so nothing here relies on
  // the app's Tailwind theme.
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:20px;">Reset your password</h1>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">
        Hi ${greetingName}, use the button below to choose a new password for your Devstash account.
      </p>
      <p style="margin:0 0 24px;">
        <a href="${resetUrl}"
           style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:15px;font-weight:500;">
          Reset password
        </a>
      </p>
      <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#52525b;">
        Or paste this link into your browser:
      </p>
      <p style="margin:0 0 24px;font-size:13px;line-height:1.5;word-break:break-all;color:#52525b;">
        ${resetUrl}
      </p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#71717a;">
        This link expires in 1 hour and can only be used once. If you did not ask to reset your password, you can ignore this email — your password will not change.
      </p>
    </div>
  </body>
</html>`;
}

function renderText(resetUrl: string, greetingName: string): string {
  return [
    `Hi ${greetingName},`,
    "",
    "Use this link to choose a new password for your Devstash account:",
    resetUrl,
    "",
    "This link expires in 1 hour and can only be used once.",
    "If you did not ask to reset your password, you can ignore this email — your password will not change.",
  ].join("\n");
}

/**
 * Sends the password reset link.
 *
 * Throws on failure rather than swallowing it, so the caller decides what a
 * failed send means. Note that the caller here deliberately does *not* pass
 * that failure on to the user in most cases — see `src/actions/password-reset.ts`.
 */
export async function sendPasswordResetEmail({
  to,
  name,
  token,
}: SendPasswordResetEmailArgs): Promise<void> {
  const resetUrl = buildPasswordResetUrl(token);
  const greetingName = name?.trim() || to;

  // Resend reports failures in the resolved `error` field rather than by
  // rejecting, so an unchecked `await` here would look like a successful send.
  const { error } = await getResend().emails.send({
    from: EMAIL_FROM,
    to,
    subject: "Reset your Devstash password",
    html: renderHtml(resetUrl, greetingName),
    // Some clients and most spam filters prefer a multipart message; sending
    // HTML alone is a deliverability penalty for no benefit.
    text: renderText(resetUrl, greetingName),
  });

  if (error) {
    throw new Error(`Resend rejected the message: ${error.message}`);
  }
}
