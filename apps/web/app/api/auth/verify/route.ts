import { NextResponse } from "next/server";

import {
  createSession,
  createUser,
  findUserByEmail,
  findValidMagicLinkToken,
  markMagicLinkTokenUsed,
} from "@kit/database";
import { env } from "@kit/shared/env";

import { setAuthCookie } from "@/lib/auth/cookies";
import { signJwt } from "@/lib/auth/jwt";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const appUrl = env.APP_URL.replace(/\/+$/, "");

  if (!token) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=missing_token`);
  }

  const row = await findValidMagicLinkToken(token);
  if (!row) {
    return NextResponse.redirect(`${appUrl}/sign-in?error=expired_token`);
  }

  await markMagicLinkTokenUsed(token);

  const email = row.email.toLowerCase();
  let user = await findUserByEmail(email);

  if (!user) {
    const username = email
      .split("@")[0]!
      .replace(/[^a-z0-9._-]/gi, "")
      .slice(0, 20);
    user = await createUser({
      username,
      email,
      fullName: username,
      passwordHash: null,
    });
  }

  const jwt = await signJwt({ sub: user.id });
  const expiresAt = new Date(Date.now() + env.SESSION_MAX_AGE * 1000);
  await createSession({ userId: user.id, token: jwt, expiresAt });

  // setAuthCookie works inside a Route Handler
  await setAuthCookie(jwt);

  return NextResponse.redirect(`${appUrl}/dashboard`);
}
