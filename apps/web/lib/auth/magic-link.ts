import "server-only";

import crypto from "node:crypto";

import { createMagicLinkToken } from "@kit/database";
import { env } from "@kit/shared/env";

const MAGIC_LINK_EXPIRY_MINUTES = 15;

/**
 * Generate a magic link token, save to DB, and send via Resend.
 */
export async function sendMagicLink(
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!env.RESEND_API_KEY) {
    return { ok: false, error: "RESEND_API_KEY not configured." };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000,
  );

  await createMagicLinkToken({ email: email.toLowerCase(), token, expiresAt });

  const baseUrl = env.APP_URL.replace(/\/+$/, "");
  const magicUrl = `${baseUrl}/verify?token=${token}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM,
      to: [email.toLowerCase()],
      subject: "Sign in to future-cmo",
      html: buildEmailHtml(magicUrl),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[magic-link] Resend error:", res.status, body);
    // Surface the actual Resend error for debugging
    let detail = "Failed to send email.";
    try {
      const parsed = JSON.parse(body) as { message?: string; statusCode?: number };
      if (parsed.message) detail = parsed.message;
    } catch { /* use default */ }
    return { ok: false, error: detail };
  }

  return { ok: true };
}

function buildEmailHtml(url: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #e5e5e5; padding: 40px 20px;">
  <div style="max-width: 460px; margin: 0 auto;">
    <p style="font-size: 12px; letter-spacing: 0.15em; text-transform: uppercase; color: #888; margin-bottom: 8px;">future-cmo</p>
    <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px 0;">Sign in to your workspace</h1>
    <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
      Click the button below to sign in. This link expires in 15 minutes.
    </p>
    <a href="${url}" style="display: inline-block; background: #e8943a; color: #000; font-weight: 600; font-size: 14px; padding: 12px 28px; border-radius: 6px; text-decoration: none;">
      Sign in
    </a>
    <p style="color: #666; font-size: 12px; margin-top: 32px; line-height: 1.5;">
      If you didn't request this, ignore this email.<br />
      <span style="color: #444;">Link: ${url}</span>
    </p>
  </div>
</body>
</html>`.trim();
}
