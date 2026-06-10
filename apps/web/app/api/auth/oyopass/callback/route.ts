import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { findUserByEmail, createUser } from "@kit/database";
import { env } from "@kit/shared/env";

import { signJwt } from "@/lib/auth/jwt";
import { setAuthCookie } from "@/lib/auth/cookies";

/**
 * GET /api/auth/oyopass/callback
 *
 * OIDC callback: exchanges the authorization code for tokens,
 * extracts user info, upserts the local user, and creates a session.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const code = q.get("code");
  const state = q.get("state");
  const error = q.get("error");

  if (error) {
    return NextResponse.redirect(new URL(`/sign-in?error=${error}`, env.APP_URL));
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/sign-in?error=missing_params", env.APP_URL));
  }

  // Verify CSRF state
  const jar = await cookies();
  const storedState = jar.get("oyopass_state")?.value;
  jar.delete("oyopass_state");

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/sign-in?error=invalid_state", env.APP_URL));
  }

  const issuer = env.OYOPASS_ISSUER;
  const clientId = env.OYOPASS_CLIENT_ID;
  const clientSecret = env.OYOPASS_CLIENT_SECRET;

  if (!issuer || !clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/sign-in?error=sso_not_configured", env.APP_URL));
  }

  // Exchange code for tokens
  const tokenRes = await fetch(`${issuer}/api/oidc/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${env.APP_URL}/api/auth/oyopass/callback`,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    console.error("OyoPass token exchange failed:", await tokenRes.text());
    return NextResponse.redirect(new URL("/sign-in?error=token_exchange_failed", env.APP_URL));
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    id_token: string;
    token_type: string;
  };

  // Fetch user info from OyoPass
  const userinfoRes = await fetch(`${issuer}/api/oidc/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userinfoRes.ok) {
    return NextResponse.redirect(new URL("/sign-in?error=userinfo_failed", env.APP_URL));
  }

  const profile = (await userinfoRes.json()) as {
    sub: string;
    email: string;
    name: string;
    role?: string;
  };

  // Upsert local user — find by email, or create
  let user = await findUserByEmail(profile.email);

  if (!user) {
    // Generate a username from email (before @, max 20 chars)
    const baseUsername = profile.email.split("@")[0]!.slice(0, 16).replace(/[^a-zA-Z0-9_-]/g, "");
    const username = `${baseUsername}${Math.random().toString(36).slice(2, 6)}`;

    user = await createUser({
      email: profile.email,
      fullName: profile.name || profile.email.split("@")[0]!,
      username,
      passwordHash: null, // SSO user — no local password
    });
  }

  // Create JWT session
  const jwt = await signJwt({ sub: user.id });
  await setAuthCookie(jwt);

  return NextResponse.redirect(new URL("/", env.APP_URL));
}
