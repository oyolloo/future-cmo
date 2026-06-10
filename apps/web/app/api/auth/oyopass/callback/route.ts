import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { findUserByEmail, createUser } from "@kit/database";
import { env } from "@kit/shared/env";

import { signJwt } from "@/lib/auth/jwt";
import { setAuthCookie } from "@/lib/auth/cookies";

/** Returns an HTML page that posts a message to the opener and closes the popup. */
function popupResponse(ok: boolean, error?: string) {
  const html = `<!DOCTYPE html><html><head><title>OyoPass</title></head><body><script>
    window.opener?.postMessage({ type: "oyopass_callback", ok: ${ok}, error: ${error ? `"${error}"` : "null"} }, "*");
    window.close();
  </script><p>${ok ? "Signed in! This window will close." : error ?? "Error"}</p></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html" } });
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const code = q.get("code");
  const state = q.get("state");
  const error = q.get("error");

  const jar = await cookies();
  const isPopup = jar.get("oyopass_popup")?.value === "1";
  jar.delete("oyopass_popup");

  const fail = (msg: string, errorCode?: string) =>
    isPopup
      ? popupResponse(false, msg)
      : NextResponse.redirect(new URL(`/sign-in?error=${errorCode ?? "unknown"}`, env.APP_URL));

  if (error) return fail(error, error);
  if (!code || !state) return fail("Missing parameters", "missing_params");

  const storedState = jar.get("oyopass_state")?.value;
  jar.delete("oyopass_state");
  if (!storedState || storedState !== state) return fail("Security check failed", "invalid_state");

  const issuer = env.OYOPASS_ISSUER;
  const clientId = env.OYOPASS_CLIENT_ID;
  const clientSecret = env.OYOPASS_CLIENT_SECRET;
  if (!issuer || !clientId || !clientSecret) return fail("SSO not configured", "sso_not_configured");

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
    return fail("Token exchange failed", "token_exchange_failed");
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    id_token: string;
    token_type: string;
  };

  // Fetch user info
  const userinfoRes = await fetch(`${issuer}/api/oidc/userinfo`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!userinfoRes.ok) return fail("Failed to get user info", "userinfo_failed");

  const profile = (await userinfoRes.json()) as {
    sub: string;
    email: string;
    name: string;
    role?: string;
  };

  // Upsert local user
  let user = await findUserByEmail(profile.email);
  if (!user) {
    const baseUsername = profile.email.split("@")[0]!.slice(0, 16).replace(/[^a-zA-Z0-9_-]/g, "");
    const username = `${baseUsername}${Math.random().toString(36).slice(2, 6)}`;
    user = await createUser({
      email: profile.email,
      fullName: profile.name || profile.email.split("@")[0]!,
      username,
      passwordHash: null,
    });
  }

  // Create session
  const jwt = await signJwt({ sub: user.id });
  await setAuthCookie(jwt);

  // Popup mode: close popup and notify parent
  if (isPopup) return popupResponse(true);

  // Normal mode: redirect
  return NextResponse.redirect(new URL("/", env.APP_URL));
}
