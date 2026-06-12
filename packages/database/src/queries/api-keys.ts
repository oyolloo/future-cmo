import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "../client";
import { apiKeys, type ApiKey, type NewApiKey } from "../schema/api-keys";

export async function findApiKeyByHash(hash: string): Promise<ApiKey | null> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hash), eq(apiKeys.active, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listApiKeysByUser(userId: string): Promise<ApiKey[]> {
  return db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
}

export async function createApiKey(input: NewApiKey): Promise<ApiKey> {
  const [row] = await db.insert(apiKeys).values(input).returning();
  if (!row) throw new Error("createApiKey: insert returned no row");
  return row;
}

export async function revokeApiKey(userId: string, id: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ active: false })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
}

export async function touchApiKeyUsage(id: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, id));
}
