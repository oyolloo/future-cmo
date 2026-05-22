import "server-only";

import bcrypt from "bcryptjs";

import {
  createSession,
  findUserByEmail,
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
  const email = input.email.trim().toLowerCase();

  const user = await findUserByEmail(email);
  if (!user) {
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password");
  }

  const matches = await bcrypt.compare(input.password, user.passwordHash);
  if (!matches) {
    throw new AuthError("INVALID_CREDENTIALS", "Invalid email or password");
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
