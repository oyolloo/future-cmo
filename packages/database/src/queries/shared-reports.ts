import "server-only";

import { and, eq, gt, isNull, or } from "drizzle-orm";

import { db } from "../client";
import {
  type NewSharedReport,
  type SharedReport,
  sharedReports,
} from "../schema/shared-reports";

export async function createSharedReport(
  input: NewSharedReport,
): Promise<SharedReport> {
  const [row] = await db.insert(sharedReports).values(input).returning();
  if (!row) throw new Error("createSharedReport: insert returned no row");
  return row;
}

/**
 * Look up an unexpired share by token. Rows with no expires_at are treated
 * as never-expiring; rows past expires_at are filtered out so the public
 * page can 404 cleanly without a "stale" state.
 */
export async function findSharedReportByToken(
  token: string,
): Promise<SharedReport | null> {
  const rows = await db
    .select()
    .from(sharedReports)
    .where(
      and(
        eq(sharedReports.token, token),
        or(
          isNull(sharedReports.expiresAt),
          gt(sharedReports.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
