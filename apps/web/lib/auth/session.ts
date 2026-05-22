import "server-only";

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
 */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = await readAuthCookie();
  if (!token) return null;

  const payload = await verifyJwt(token);
  if (!payload) return null;

  const user = await findUserById(payload.sub);
  if (!user) return null;

  return stripPasswordHash(user);
}
