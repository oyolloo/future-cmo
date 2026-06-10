import { NextResponse } from "next/server";
import { z } from "zod";

import { sendMagicLink } from "@/lib/auth/magic-link";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: parsed.error.issues[0]?.message ?? "Invalid email" } },
      { status: 400 },
    );
  }

  const result = await sendMagicLink(parsed.data.email);

  if (!result.ok) {
    return NextResponse.json(
      { error: { message: result.error } },
      { status: 500 },
    );
  }

  // Always return success even if email doesn't exist (prevent enumeration).
  return NextResponse.json({ ok: true });
}
