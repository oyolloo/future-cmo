import "server-only";

import { jwtVerify, SignJWT } from "jose";

import { env } from "@kit/shared/env";

const SECRET = new TextEncoder().encode(env.JWT_SECRET);
const ALG = "HS256";

export type JwtPayload = {
  sub: string; // userId
};

export async function signJwt(
  payload: JwtPayload,
  expiresInSeconds: number = env.SESSION_MAX_AGE,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: payload.sub })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt(now)
    .setExpirationTime(now + expiresInSeconds)
    .sign(SECRET);
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: [ALG] });
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
