import "server-only";

export async function sendViaBrevo(input: {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": input.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { email: input.fromEmail, name: input.fromName },
      to: [{ email: input.to }],
      subject: input.subject,
      textContent: input.text,
      htmlContent: input.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = `Brevo ${res.status}`;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) msg = parsed.message;
    } catch { /* use default */ }
    return { ok: false, error: msg };
  }

  const json = (await res.json()) as { messageId?: string };
  return { ok: true, messageId: json.messageId ?? "unknown" };
}
