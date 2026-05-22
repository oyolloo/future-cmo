import { NextResponse } from "next/server";

import { deleteSession } from "@kit/database";

import { clearAuthCookie, readAuthCookie } from "@/lib/auth/cookies";

export async function POST() {
  const token = await readAuthCookie();
  if (token) {
    await deleteSession(token);
  }
  await clearAuthCookie();
  return NextResponse.json({ ok: true });
}
