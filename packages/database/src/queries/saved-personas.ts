import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "../client";
import {
  savedPersonas,
  type NewSavedPersonaRow,
  type SavedPersonaRow,
} from "../schema/saved-personas";

export async function createSavedPersona(
  input: NewSavedPersonaRow,
): Promise<SavedPersonaRow> {
  const [row] = await db.insert(savedPersonas).values(input).returning();
  if (!row) throw new Error("insert returned no row");
  return row;
}

export async function listSavedPersonas(
  userId: string,
): Promise<SavedPersonaRow[]> {
  return db
    .select()
    .from(savedPersonas)
    .where(eq(savedPersonas.userId, userId))
    .orderBy(desc(savedPersonas.createdAt));
}

export async function findSavedPersona(
  userId: string,
  id: string,
): Promise<SavedPersonaRow | null> {
  const rows = await db
    .select()
    .from(savedPersonas)
    .where(eq(savedPersonas.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.userId !== userId) return null;
  return row;
}

export async function deleteSavedPersona(
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(savedPersonas)
    .where(eq(savedPersonas.id, id))
    .returning({ id: savedPersonas.id });
  return rows.length > 0;
}
