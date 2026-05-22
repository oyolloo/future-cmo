import "server-only";

import bcrypt from "bcryptjs";

import {
  createSession,
  createUser,
  findUserByEmail,
  findUserByUsername,
  type User,
} from "@kit/database";
import { env } from "@kit/shared/env";

import { AuthError } from "@/lib/auth/errors";
import { signJwt } from "@/lib/auth/jwt";

import type { RegisterInput } from "./schema";

const BCRYPT_ROUNDS = 10;

export type RegisterResult = {
  user: User;
  token: string;
};

export async function registerUser(
  input: RegisterInput,
): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  const username = input.username.trim();
  const company =
    input.company && input.company.length > 0 ? input.company.trim() : null;

  const [existingEmail, existingUsername] = await Promise.all([
    findUserByEmail(email),
    findUserByUsername(username),
  ]);
  if (existingEmail) {
    throw new AuthError("DUPLICATE_EMAIL", "Email already registered");
  }
  if (existingUsername) {
    throw new AuthError("DUPLICATE_USERNAME", "Username already taken");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await createUser({
    username,
    email,
    fullName: input.fullName.trim(),
    passwordHash,
    company,
  });

  const token = await signJwt({ sub: user.id });
  const expiresAt = new Date(Date.now() + env.SESSION_MAX_AGE * 1000);

  await createSession({
    userId: user.id,
    token,
    expiresAt,
  });

  return { user, token };
}
