import Link from "next/link";

import {
  aggregateAuditScores,
  businessOverall,
  scoreAuditSections,
} from "@/lib/audit/score";
import { requireUser } from "@/lib/auth/session";
import { getPlaceDetails, type PlaceDetails } from "@/lib/maps/places";

import {
  MarketingAuditReport,
  type RankedBusiness,
} from "../_components/marketing-audit-report";

export const metadata = {
  title: "Marketing Audit Report · future-cmo",
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ placeId?: string | string[] }>;
}) {
  await requireUser();

  const raw = (await searchParams).placeId;
  const placeIds = Array.isArray(raw) ? raw : raw ? [raw] : [];

  if (placeIds.length === 0) {
    return <EmptyReport />;
  }

  const { businesses, overall, sections, failures } =
    await loadAndScore(placeIds);

  return (
    <>
      <div className="px-8 pt-10" data-print-hide>
        <Link
          href="/gm-prospecting"
          className="text-comment hover:text-foreground"
        >
          ← back to prospecting
        </Link>
      </div>
      <MarketingAuditReport
        businesses={businesses}
        overall={overall}
        sections={sections}
        failures={failures}
        mode="authenticated"
        placeIds={placeIds}
      />
    </>
  );
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

export async function loadAndScore(placeIds: string[]): Promise<{
  businesses: RankedBusiness[];
  overall: number;
  sections: ReturnType<typeof aggregateAuditScores>["sections"];
  failures: number;
}> {
  const settled = await Promise.allSettled(
    placeIds.map((id) => getPlaceDetails(id)),
  );
  const failures = settled.filter((r) => r.status === "rejected").length;

  const businesses: RankedBusiness[] = settled
    .filter(
      (r): r is PromiseFulfilledResult<PlaceDetails> =>
        r.status === "fulfilled",
    )
    .map((r) => {
      const sections = scoreAuditSections(r.value);
      return {
        details: r.value,
        sections,
        overall: businessOverall(sections),
      };
    })
    .sort((a, b) => a.overall - b.overall); // weakest first = biggest opportunity

  const { overall, sections } = aggregateAuditScores(
    businesses.map((b) => b.sections),
  );

  return { businesses, overall, sections, failures };
}
