import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "../client";
import {
  type NewProspectReport,
  type ProspectReport,
  prospectReports,
} from "../schema/prospect-reports";

export async function createProspectReport(
  input: NewProspectReport,
): Promise<ProspectReport> {
  const [row] = await db.insert(prospectReports).values(input).returning();
  if (!row) throw new Error("createProspectReport: insert returned no row");
  return row;
}

/**
 * List a user's reports — newest first. Excludes the heavy `snapshot`
 * column since the list view only needs metadata.
 */
export async function listProspectReportsByUserId(userId: string): Promise<
  Array<{
    id: string;
    name: string;
    businessCount: number;
    overallScore: number;
    createdAt: Date;
  }>
> {
  return db
    .select({
      id: prospectReports.id,
      name: prospectReports.name,
      businessCount: prospectReports.businessCount,
      overallScore: prospectReports.overallScore,
      createdAt: prospectReports.createdAt,
    })
    .from(prospectReports)
    .where(eq(prospectReports.userId, userId))
    .orderBy(desc(prospectReports.createdAt));
}

export async function findProspectReportById(
  userId: string,
  id: string,
): Promise<ProspectReport | null> {
  const rows = await db
    .select()
    .from(prospectReports)
    .where(
      and(eq(prospectReports.id, id), eq(prospectReports.userId, userId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function deleteProspectReport(
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await db
    .delete(prospectReports)
    .where(
      and(eq(prospectReports.id, id), eq(prospectReports.userId, userId)),
    )
    .returning({ id: prospectReports.id });
  return rows.length > 0;
}
