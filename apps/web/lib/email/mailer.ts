import "server-only";

import { sendViaBrevo } from "./providers/brevo";
import { sendViaResend } from "./providers/resend";

export type EmailProvider = "resend" | "brevo";

export type SendEmailInput = {
  provider: EmailProvider;
  apiKey: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
};

export type SendEmailResult =
  | { ok: true; messageId: string }
  | { ok: false; error: { message: string } };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const from = `${input.fromName} <${input.fromEmail}>`;

  switch (input.provider) {
    case "resend": {
      const res = await sendViaResend({
        apiKey: input.apiKey,
        from,
        to: input.to,
        subject: input.subject,
        text: input.body,
        html: input.html,
      });
      return res.ok
        ? { ok: true, messageId: res.messageId }
        : { ok: false, error: { message: res.error } };
    }

    case "brevo": {
      const res = await sendViaBrevo({
        apiKey: input.apiKey,
        fromEmail: input.fromEmail,
        fromName: input.fromName,
        to: input.to,
        subject: input.subject,
        text: input.body,
        html: input.html,
      });
      return res.ok
        ? { ok: true, messageId: res.messageId }
        : { ok: false, error: { message: res.error } };
    }

    default:
      return { ok: false, error: { message: `Unsupported provider: ${input.provider}` } };
  }
}
