import { Building2, Sparkles, Star } from "lucide-react";

import { cn } from "@kit/ui/lib/utils";

import {
  auditBand,
  type AuditBand,
  type AuditSectionScore,
} from "@/lib/audit/score";
import type { PlaceDetails } from "@/lib/maps/places";

import { PrintButton } from "./print-button";
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
};

export function MarketingAuditReport({
  businesses,
  overall,
  sections,
  failures,
  mode = "authenticated",
  placeIds,
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
        <aside className="space-y-1.5">
          <ScoreRow label="Overall Score" score={overall} highlight />
          {sections.map((s) => (
            <ScoreRow
              key={s.key}
              label={s.label}
              score={s.score}
              status={s.status}
            />
          ))}
        </aside>

        <main className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-label w-16 px-4 py-2.5 text-left">Rank</th>
                <th className="text-label px-4 py-2.5 text-left">
                  Business Name
                </th>
                <th className="text-label w-28 px-4 py-2.5 text-left">
                  GBP Photos
                </th>
                <th className="text-label w-28 px-4 py-2.5 text-left">
                  GBP Reviews
                </th>
                <th className="text-label w-44 px-4 py-2.5 text-left">
                  GBP Star Rating
                </th>
              </tr>
            </thead>
            <tbody>
              {businesses.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    No details could be fetched for the selected businesses.
                  </td>
                </tr>
              ) : (
                businesses.map((b, idx) => (
                  <BusinessRow
                    key={b.details.placeId}
                    rank={idx + 1}
                    business={b}
                  />
                ))
              )}
            </tbody>
          </table>
        </main>
      </div>

      <p className="text-comment mt-8" data-print-hide>
        {
          "// Techno Stack · Listings · SEO Analysis sections are wired but unscored (Phase 2C — PageSpeed Insights + NAP scanners + HTML probes)"
        }
      </p>
    </div>
  );
}

function ScoreRow({
  label,
  score,
  status = "implemented",
  highlight = false,
}: {
  label: string;
  score: number;
  status?: "implemented" | "placeholder";
  highlight?: boolean;
}) {
  const band: AuditBand = auditBand(score);
  const badgeStyles: Record<AuditBand, string> = {
    weak: "border-destructive/30 bg-destructive/10 text-destructive",
    warming:
      "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
    strong:
      "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md border px-4 py-3 transition-colors",
        highlight
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-card hover:bg-muted/30",
      )}
    >
      <span
        className={cn(
          "text-sm",
          highlight ? "font-medium text-primary" : "text-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider",
          status === "placeholder"
            ? "border-border bg-muted/40 text-muted-foreground/60"
            : badgeStyles[band],
        )}
      >
        {score}%
      </span>
    </div>
  );
}

function BusinessRow({
  rank,
  business,
}: {
  rank: number;
  business: RankedBusiness;
}) {
  const { details } = business;
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/30">
      <td className="px-4 py-3 align-middle">
        <span className="font-mono text-xs text-muted-foreground">
          {String(rank).padStart(2, "0")}
        </span>
      </td>
      <td className="px-4 py-3 align-middle">
        {details.googleMapsUri ? (
          <a
            href={details.googleMapsUri}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            {details.name}
          </a>
        ) : (
          <span className="text-sm font-medium">{details.name}</span>
        )}
        {details.formattedAddress ? (
          <p className="truncate font-mono text-xs text-muted-foreground">
            {details.formattedAddress}
          </p>
        ) : null}
      </td>
      <td className="px-4 py-3 align-middle text-sm">
        {details.photoNames.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <Building2 className="size-3.5 text-muted-foreground" />
            {details.photoNames.length}
          </span>
        ) : (
          <span className="text-muted-foreground">No</span>
        )}
      </td>
      <td className="px-4 py-3 align-middle text-sm">
        {details.reviewCount ?? 0}
      </td>
      <td className="px-4 py-3 align-middle text-sm">
        {details.rating != null ? (
          <StarRating rating={details.rating} />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="flex">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "size-3.5",
              i < full
                ? "fill-primary text-primary"
                : "fill-transparent text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      <span className="font-mono text-xs text-muted-foreground">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}
