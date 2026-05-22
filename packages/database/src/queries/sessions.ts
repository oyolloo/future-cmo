import "server-only";

import { eq } from "drizzle-orm";

import { db } from "../client";
import { type NewSession, type Session, sessions } from "../schema/sessions";

export async function createSession(input: NewSession): Promise<Session> {
  const [session] = await db.insert(sessions).values(input).returning();
  if (!session) throw new Error("createSession: insert returned no row");
  return session;
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}
