import { NextResponse } from "next/server";

import { registerSchema } from "@/app/(auth)/sign-up/_lib/schema";
import { registerUser } from "@/app/(auth)/sign-up/_lib/service";
import { setAuthCookie } from "@/lib/auth/cookies";
import { isAuthError } from "@/lib/auth/errors";
import { stripPasswordHash } from "@/lib/auth/session";

const STATUS_BY_CODE: Record<string, number> = {
  VALIDATION_FAILED: 400,
  DUPLICATE_EMAIL: 409,
  DUPLICATE_USERNAME: 409,
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

  const parsed = registerSchema.safeParse(body);
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
    const { user, token } = await registerUser(parsed.data);
    await setAuthCookie(token);
    return NextResponse.json(
      { user: stripPasswordHash(user) },
      { status: 201 },
    );
  } catch (err) {
    if (isAuthError(err)) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message } },
        { status: STATUS_BY_CODE[err.code] ?? 400 },
      );
    }
    console.error("[POST /api/auth/register]", err);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Server error, try again" } },
      { status: 500 },
    );
  }
}

