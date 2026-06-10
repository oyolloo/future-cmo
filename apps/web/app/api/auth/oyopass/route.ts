import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { env } from "@kit/shared/env";

/**
 * GET /api/auth/oyopass
 *
 * Redirects the user to the OyoPass authorization endpoint (OIDC authorization code flow).
 * Stores a random `state` in a cookie to prevent CSRF.
 */
export async function GET() {
  const issuer = env.OYOPASS_ISSUER;
  const clientId = env.OYOPASS_CLIENT_ID;

  if (!issuer || !clientId) {
    return NextResponse.json({ error: "OyoPass SSO is not configured" }, { status: 500 });
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = `${env.APP_URL}/api/auth/oyopass/callback`;

  // Store state + popup flag in cookies for CSRF verification
  const jar = await cookies();
  jar.set("oyopass_state", state, {
    httpOnly: true,
    secure: env.APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });
  jar.set("oyopass_popup", "1", {
    httpOnly: true,
    secure: env.APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: 300,
  });

  const authUrl = new URL(`${issuer}/api/oidc/authorize`);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email");
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
