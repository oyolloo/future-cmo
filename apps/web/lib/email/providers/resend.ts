import "server-only";

export async function sendViaResend(input: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: input.from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = `Resend ${res.status}`;
    try {
      const parsed = JSON.parse(body) as { message?: string };
      if (parsed.message) msg = parsed.message;
    } catch { /* use default */ }
    return { ok: false, error: msg };
  }

  const json = (await res.json()) as { id?: string };
  return { ok: true, messageId: json.id ?? "unknown" };
}
