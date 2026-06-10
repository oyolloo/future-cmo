import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import { db } from "../client";
import {
  magicLinkTokens,
  type MagicLinkTokenRow,
} from "../schema/magic-link-tokens";

export async function createMagicLinkToken(input: {
  email: string;
  token: string;
  expiresAt: Date;
}): Promise<MagicLinkTokenRow> {
  const [row] = await db
    .insert(magicLinkTokens)
    .values(input)
    .returning();
  return row!;
}

/**
 * Find a valid (not expired, not used) magic link token.
 */
export async function findValidMagicLinkToken(
  token: string,
): Promise<MagicLinkTokenRow | null> {
  const rows = await db
    .select()
    .from(magicLinkTokens)
    .where(
      and(
        eq(magicLinkTokens.token, token),
        gt(magicLinkTokens.expiresAt, new Date()),
        isNull(magicLinkTokens.usedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function markMagicLinkTokenUsed(token: string): Promise<void> {
  await db
    .update(magicLinkTokens)
    .set({ usedAt: new Date() })
    .where(eq(magicLinkTokens.token, token));
}
