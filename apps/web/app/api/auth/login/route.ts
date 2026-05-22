import { NextResponse } from "next/server";

import { loginSchema } from "@/app/(auth)/sign-in/_lib/schema";
import { loginUser } from "@/app/(auth)/sign-in/_lib/service";
import { setAuthCookie } from "@/lib/auth/cookies";
import { isAuthError } from "@/lib/auth/errors";
import { stripPasswordHash } from "@/lib/auth/session";

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_FAILED: 400,
  INVALID_CREDENTIALS: 401,
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "VALIDATION_FAILED", message: "Invalid JSON body" } },
      { status: 400 },
    );
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: parsed.error.issues[0]?.message ?? "Invalid input",
          issues: parsed.error.issues,
        },
      },
      { status: 400 },
    );
  }

  try {
    const { user, token } = await loginUser(parsed.data);
    await setAuthCookie(token);
    return NextResponse.json({ user: stripPasswordHash(user) });
  } catch (err) {
    if (isAuthError(err)) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: STATUS_BY_CODE[err.code] ?? 400 },
      );
    }
    console.error("[POST /api/auth/login]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Server error, try again" } },
      { status: 500 },
    );
  }
}
