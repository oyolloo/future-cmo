import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { saveReport } from "@/lib/reports/service";
import type { ReportSnapshot } from "@/lib/reports/types";

import { loadAndScore } from "../_lib/load-and-score";

export const metadata = {
  title: "Generating Marketing Audit Report · future-cmo",
};

/**
 * Generator-then-redirect. `?placeId=X&placeId=Y` triggers:
 *   1. Fetch + score (Google Places + PageSpeed, cached upstream)
 *   2. Persist snapshot to prospect_reports
 *   3. Redirect to /gm-prospecting/reports/[id] — the durable URL
 *
 * The redirect target reads from DB only — no further upstream calls on
 * re-view.
 */
export default async function GenerateReportPage({
  searchParams,
}: {
  searchParams: Promise<{ placeId?: string | string[] }>;
}) {
  const user = await requireUser();

  const raw = (await searchParams).placeId;
  const placeIds = Array.isArray(raw) ? raw : raw ? [raw] : [];

  if (placeIds.length === 0) {
    return <EmptyReport />;
  }

  const { businesses, overall, sections, failures } =
    await loadAndScore(placeIds);

  const snapshot: ReportSnapshot = {
    v: 1,
    businesses,
    overall,
    sections,
    failures,
    generatedAt: new Date().toISOString(),
  };

  const report = await saveReport(user.id, placeIds, snapshot);
  redirect(`/gm-prospecting/reports/${report.id}`);
}

function EmptyReport() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <Link
        href="/gm-prospecting"
        className="text-comment hover:text-foreground"
      >
        ← back to prospecting
      </Link>
      <header className="mt-6">
        <p className="text-label">— marketing audit report</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          No businesses selected.
        </h1>
        <p className="text-comment mt-2">
          {"// go back · click + Add on some rows · then Report"}
        </p>
      </header>
    </div>
  );
}
