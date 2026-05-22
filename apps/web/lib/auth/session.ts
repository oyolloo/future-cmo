import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { findUserById, type User } from "@kit/database";

import { readAuthCookie } from "./cookies";
import { verifyJwt } from "./jwt";

export type PublicUser = Omit<User, "passwordHash">;

export function stripPasswordHash(user: User): PublicUser {
  const { passwordHash: _h, ...rest } = user;
  return rest;
}

/**
 * Read the auth cookie, verify the JWT, return the current user (without
 * password hash). Returns null on missing cookie, expired/invalid JWT, or
 * deleted user.
 *
 * Wrapped in React.cache so multiple callers in the same request (e.g. a
 * Server Component layout + a child page) share one DB round-trip.
 */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const token = await readAuthCookie();
  if (!token) return null;

  const payload = await verifyJwt(token);
  if (!payload) return null;

  const user = await findUserById(payload.sub);
  if (!user) return null;

  return stripPasswordHash(user);
});

/**
 * Like getCurrentUser, but redirects to /sign-in when unauthenticated.
 * Returns a non-null user; never resolves on the redirect path.
 */
export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}
