import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// ─── Types ───────────────────────────────────────────────────────────

export interface OyoPassProfile {
  sub: string;
  email: string;
  name: string;
  email_verified?: boolean;
  role?: string;
  permissions?: string[];
}

export interface OyoPassTokens {
  access_token: string;
  id_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export interface OyoPassConfig {
  /** OyoPass issuer URL (e.g. https://oyopass.oyolloo.com) */
  issuer: string;
  /** OIDC client ID from OyoPass dashboard */
  clientId: string;
  /** OIDC client secret from OyoPass dashboard */
  clientSecret: string;
  /** Your app's public URL (e.g. https://myapp.oyolloo.com) */
  appUrl: string;
  /** Callback path (default: /api/auth/oyopass/callback) */
  callbackPath?: string;
  /** OIDC scopes (default: "openid profile email") */
  scopes?: string;
  /**
   * Called after successful authentication.
   * Use this to upsert the user, create a session, set cookies, etc.
   * Return the redirect URL (e.g. "/dashboard").
   */
  onSuccess: (profile: OyoPassProfile, tokens: OyoPassTokens) => Promise<string>;
  /**
   * Called on error. Return the redirect URL (e.g. "/login?error=...").
   * If not provided, defaults to redirecting to "/login?error=<code>".
   */
  onError?: (error: string, code: string) => string;
}

// ─── Internal constants ──────────────────────────────────────────────

const STATE_COOKIE = "oyopass_state";
const POPUP_COOKIE = "oyopass_popup";
const COOKIE_MAX_AGE = 300; // 5 minutes

// ─── Factory ─────────────────────────────────────────────────────────

/**
 * Creates OyoPass OIDC handlers for your Next.js app.
 *
 * Usage:
 * ```ts
 * // lib/oyopass.ts
 * export const oyopass = createOyoPass({ issuer, clientId, ... });
 *
 * // app/api/auth/oyopass/route.ts
 * export const GET = () => oyopass.initiateHandler();
 *
 * // app/api/auth/oyopass/callback/route.ts
 * export const GET = (req) => oyopass.callbackHandler(req);
 * ```
 */
export function createOyoPass(config: OyoPassConfig) {
  const {
    issuer,
    clientId,
    clientSecret,
    appUrl,
    callbackPath = "/api/auth/oyopass/callback",
    scopes = "openid profile email",
    onSuccess,
    onError = (_, code) => `/login?error=${code}`,
  } = config;

  const redirectUri = `${appUrl}${callbackPath}`;
  const isSecure = appUrl.startsWith("https://");

  function cookieOpts() {
    return {
      httpOnly: true,
      secure: isSecure,
      sameSite: "lax" as const,
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    };
  }

  // ─── Popup HTML helper ───────────────────────────────────────────

  function popupHtml(ok: boolean, error?: string) {
    return `<!DOCTYPE html><html><head><title>OyoPass</title></head><body><script>
      window.opener?.postMessage({ type: "oyopass_callback", ok: ${ok}, error: ${error ? JSON.stringify(error) : "null"} }, "*");
      window.close();
    </script><p>${ok ? "Signed in! This window will close." : error ?? "Error"}</p></body></html>`;
  }

  // ─── GET — initiate OIDC flow ────────────────────────────────────

  async function initiateHandler() {
    if (!issuer || !clientId) {
      return NextResponse.json({ error: "OyoPass SSO is not configured" }, { status: 500 });
    }

    const state = randomBytes(16).toString("hex");
    const jar = await cookies();
    jar.set(STATE_COOKIE, state, cookieOpts());
    jar.set(POPUP_COOKIE, "1", cookieOpts());

    const authUrl = new URL(`${issuer}/api/oidc/authorize`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    return NextResponse.redirect(authUrl.toString());
  }

  // ─── GET — handle OIDC callback ──────────────────────────────────

  async function callbackHandler(req: NextRequest) {
    const q = req.nextUrl.searchParams;
    const code = q.get("code");
    const state = q.get("state");
    const errorParam = q.get("error");

    const jar = await cookies();
    const isPopup = jar.get(POPUP_COOKIE)?.value === "1";
    jar.delete(POPUP_COOKIE);

    const fail = (msg: string, errCode: string) => {
      if (isPopup) {
        return new NextResponse(popupHtml(false, msg), { headers: { "Content-Type": "text/html" } });
      }
      return NextResponse.redirect(new URL(onError(msg, errCode), appUrl));
    };

    if (errorParam) return fail(errorParam, errorParam);
    if (!code || !state) return fail("Missing parameters", "missing_params");

    // CSRF check
    const storedState = jar.get(STATE_COOKIE)?.value;
    jar.delete(STATE_COOKIE);
    if (!storedState || storedState !== state) return fail("Security check failed", "invalid_state");

    // Token exchange
    let tokenRes: Response;
    try {
      tokenRes = await fetch(`${issuer}/api/oidc/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
    } catch (fetchErr) {
      console.error("[OyoPass] Fetch failed:", fetchErr);
      return fail("Cannot reach OyoPass server", "network_error");
    }

    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => "");
      console.error("[OyoPass] Token exchange failed:", tokenRes.status, body);
      return fail("Token exchange failed", "token_exchange_failed");
    }

    const tokens = (await tokenRes.json()) as OyoPassTokens;

    // Userinfo
    const userinfoRes = await fetch(`${issuer}/api/oidc/userinfo`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userinfoRes.ok) return fail("Failed to get user info", "userinfo_failed");

    const profile = (await userinfoRes.json()) as OyoPassProfile;

    // Call the app's onSuccess handler
    let redirectTo: string;
    try {
      redirectTo = await onSuccess(profile, tokens);
    } catch (err) {
      console.error("[OyoPass] onSuccess error:", err);
      return fail("Login processing failed", "callback_error");
    }

    // Popup mode — send postMessage to parent, then close
    if (isPopup) {
      return new NextResponse(popupHtml(true), { headers: { "Content-Type": "text/html" } });
    }

    return NextResponse.redirect(new URL(redirectTo, appUrl));
  }

  return { initiateHandler, callbackHandler };
}
