import "server-only";

import {
  createProspectReport,
  deleteProspectReport,
  findProspectReportById,
  listProspectReportsByUserId,
  type ProspectReport,
} from "@kit/database";

import type { ReportSnapshot } from "./types";

/**
 * Auto-generate a human-readable report name from the snapshot. We try to
 * extract the most common city from the business addresses; falls back to
 * a date-only label. User can rename in v2.
 */
function autoReportName(snapshot: ReportSnapshot): string {
  const date = new Date(snapshot.generatedAt).toISOString().slice(0, 10);
  const count = snapshot.businesses.length;
  const noun = count === 1 ? "business" : "businesses";

  const cityCounts = new Map<string, number>();
  for (const b of snapshot.businesses) {
    const addr = b.details.formattedAddress;
    if (!addr) continue;
    // "1121 S Horne, Mesa, AZ 85204, USA" → "Mesa, AZ"
    const parts = addr.split(",").map((p) => p.trim());
    if (parts.length >= 3) {
      const city = parts[parts.length - 3];
      const stateZip = parts[parts.length - 2]?.split(/\s+/)[0];
      if (city && stateZip) {
        const key = `${city}, ${stateZip}`;
        cityCounts.set(key, (cityCounts.get(key) ?? 0) + 1);
      }
    }
  }

  const topCity = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topCity) return `${topCity} · ${count} ${noun} · ${date}`;
  return `Audit · ${date} · ${count} ${noun}`;
}

export async function saveReport(
  userId: string,
  placeIds: string[],
  snapshot: ReportSnapshot,
): Promise<ProspectReport> {
  return createProspectReport({
    userId,
    name: autoReportName(snapshot),
    placeIds,
    businessCount: snapshot.businesses.length,
    overallScore: snapshot.overall,
    snapshot,
  });
}

export async function listReports(userId: string) {
  return listProspectReportsByUserId(userId);
}

export async function getReport(
  userId: string,
  id: string,
): Promise<{ report: ProspectReport; snapshot: ReportSnapshot } | null> {
  const report = await findProspectReportById(userId, id);
  if (!report) return null;
  return { report, snapshot: report.snapshot as ReportSnapshot };
}

export async function deleteReport(
  userId: string,
  id: string,
): Promise<boolean> {
  return deleteProspectReport(userId, id);
}
