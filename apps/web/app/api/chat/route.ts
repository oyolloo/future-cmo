import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { askHermes } from "@/lib/ai/hermes";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.message || typeof body.message !== "string") {
    return NextResponse.json(
      { ok: false, error: "Missing 'message' field" },
      { status: 400 },
    );
  }

  const messages: { role: "system" | "user"; content: string }[] = [];

  if (body.systemPrompt && typeof body.systemPrompt === "string") {
    messages.push({ role: "system", content: body.systemPrompt });
  }

  if (Array.isArray(body.history)) {
    for (const msg of body.history) {
      if (msg?.role && msg?.content) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
  }

  messages.push({ role: "user", content: body.message });

  const result = await askHermes(messages, {
    conversation: typeof body.conversation === "string"
      ? body.conversation
      : `fcmo-${user.id}`,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error.message },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, reply: result.text });
}
