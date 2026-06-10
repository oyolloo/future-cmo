import "server-only";

import bcrypt from "bcryptjs";

import {
  createSession,
  findUserByEmail,
  findUserByUsername,
  type User,
} from "@kit/database";
import { env } from "@kit/shared/env";

import { AuthError } from "@/lib/auth/errors";
import { signJwt } from "@/lib/auth/jwt";

import type { LoginInput } from "./schema";

export type LoginResult = {
  user: User;
  token: string;
};

export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const identifier = input.identifier.trim().toLowerCase();

  // Detect if the input looks like an email or a username.
  const isEmail = identifier.includes("@");
  const user = isEmail
    ? await findUserByEmail(identifier)
    : await findUserByUsername(identifier);

  if (!user) {
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email/username or password");
  }

  // Magic-link-only users have no password hash — password login not possible.
  if (!user.passwordHash) {
    throw new AuthError("INVALID_CREDENTIALS", "This account uses magic link sign-in. Check your email.");
  }

  const matches = await bcrypt.compare(input.password, user.passwordHash);
  if (!matches) {
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email/username or password");
  }

  const expirySeconds = input.rememberMe
    ? env.SESSION_MAX_AGE
    : Math.min(env.SESSION_MAX_AGE, 60 * 60 * 24); // 1 day if rememberMe=false

  const token = await signJwt({ sub: user.id }, expirySeconds);
  const expiresAt = new Date(Date.now() + expirySeconds * 1000);

  await createSession({
    userId: user.id,
    token,
    expiresAt,
  });

  return { user, token };
}
