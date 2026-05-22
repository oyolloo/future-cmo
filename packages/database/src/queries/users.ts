import "server-only";

import { eq } from "drizzle-orm";

import { db } from "../client";
import { type NewUser, type User, users } from "../schema/users";

export async function findUserByEmail(email: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserByUsername(
  username: string,
): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<User | null> {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * `passwordHash` must already be hashed (e.g. bcrypt) by the caller —
 * this layer is intentionally dumb about credentials.
 */
export async function createUser(input: NewUser): Promise<User> {
  const [user] = await db.insert(users).values(input).returning();
  if (!user) throw new Error("createUser: insert returned no row");
  return user;
}
