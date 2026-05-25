import { SparklesIcon as Sparkles } from "@kit/ui/icons";

import type { AuditSectionScore } from "@/lib/audit/score";
import type { PlaceDetails } from "@/lib/maps/places";

import { BusinessTable } from "./business-table";
import { PrintButton } from "./print-button";
import { ScoreAside } from "./score-aside";
import { ShareButton } from "./share-button";

export type RankedBusiness = {
  details: PlaceDetails;
  sections: AuditSectionScore[];
  overall: number;
};

export type AuditReportProps = {
  businesses: RankedBusiness[];
  overall: number;
  sections: AuditSectionScore[];
  failures: number;
  /** When set, the page renders in "share" mode: ShareButton is hidden,
   *  the "← back to prospecting" link is replaced with a public-facing
   *  caption, and Print stays available. */
  mode?: "authenticated" | "public";
  /** Used to wire the Share button — undefined in public mode. */
  placeIds?: string[];
  /**
   * Absolute URL prefix for per-business detail pages. We pass an
   * explicit path instead of relying on relative URL resolution because
   * `business/${placeId}` against `/reports/[id]` (no trailing slash)
   * resolves to `/reports/business/${placeId}` per the URL spec —
   * wrong directory. Pass e.g. `/gm-prospecting/reports/${id}/business`
   * or `/r/${token}/business`.
   */
  businessDetailBasePath: string;
};

export function MarketingAuditReport({
  businesses,
  overall,
  sections,
  failures,
  mode = "authenticated",
  placeIds,
  businessDetailBasePath,
}: AuditReportProps) {
  return (
    <div className="mx-auto max-w-7xl px-8 py-10" data-report-root>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label">— marketing audit report</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Marketing Audit Report
            </h1>
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-primary">
              <Sparkles className="size-3" />
              Premium
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "public"
              ? "Shared by your agency. Public link — anyone with the URL can view."
              : "Share this report with your clients to sell your services."}
          </p>
        </div>

        <div className="flex flex-col items-end gap-3" data-print-hide>
          <p className="text-comment">
            {`// generated for ${businesses.length} ${
              businesses.length === 1 ? "business" : "businesses"
            }${failures > 0 ? ` · ${failures} failed` : ""}`}
          </p>
          <div className="flex items-center gap-2">
            {mode === "authenticated" && placeIds ? (
              <ShareButton placeIds={placeIds} />
            ) : null}
            <PrintButton />
          </div>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[280px_1fr]">
        <ScoreAside overall={overall} sections={sections} />
        <BusinessTable
          businesses={businesses}
          businessDetailBasePath={businessDetailBasePath}
        />
      </div>

      <p className="text-comment mt-8" data-print-hide>
        {
          "// Techno Stack · Listings · SEO Analysis sections are wired but unscored (Phase 2C — PageSpeed Insights + NAP scanners + HTML probes)"
        }
      </p>
    </div>
  );
}
