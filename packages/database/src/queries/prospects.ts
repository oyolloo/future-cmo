import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "../client";
import {
  type NewProspect,
  type Prospect,
  prospects,
} from "../schema/prospects";

export async function findProspectByUserAndPlace(
  userId: string,
  placeId: string,
): Promise<Prospect | null> {
  const rows = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.userId, userId), eq(prospects.placeId, placeId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function findProspectByIdForUser(
  id: string,
  userId: string,
): Promise<Prospect | null> {
  const rows = await db
    .select()
    .from(prospects)
    .where(and(eq(prospects.id, id), eq(prospects.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listProspectsByUser(userId: string): Promise<Prospect[]> {
  return db
    .select()
    .from(prospects)
    .where(eq(prospects.userId, userId))
    .orderBy(prospects.createdAt);
}

export async function createProspect(input: NewProspect): Promise<Prospect> {
  const [row] = await db.insert(prospects).values(input).returning();
  if (!row) throw new Error("createProspect: insert returned no row");
  return row;
}
