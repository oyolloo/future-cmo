import "server-only";

import { cookies } from "next/headers";

import { env } from "@kit/shared/env";

export const AUTH_COOKIE_NAME = "auth-token";

function baseOptions() {
  return {
    httpOnly: true,
    // Only set secure flag when serving over HTTPS. Dokploy with HTTP
    // (sslip.io without TLS) needs secure=false or the browser silently
    // refuses to store the cookie.
    secure: env.APP_URL.startsWith("https://"),
    sameSite: "lax" as const,
    path: "/",
  };
}

export async function setAuthCookie(token: string, maxAgeSeconds?: number) {
  const jar = await cookies();
  jar.set(AUTH_COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: maxAgeSeconds ?? env.SESSION_MAX_AGE,
  });
}

export async function clearAuthCookie() {
  const jar = await cookies();
  jar.set(AUTH_COOKIE_NAME, "", {
    ...baseOptions(),
    maxAge: 0,
  });
}

export async function readAuthCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(AUTH_COOKIE_NAME)?.value ?? null;
}
