"use client";

import { useState } from "react";

import { cn } from "@kit/ui/lib/utils";

import type { ListingOptimization } from "@/lib/ai/app-listing-optimizer";
import type { AppListingData } from "@/lib/audit/shopify-app-listing";
import type {
  ListingCategory,
  ListingCheck,
  ListingPulse,
} from "@/lib/audit/shopify-listing-checks";

type Props = {
  data: {
    listing: AppListingData;
    pulse: ListingPulse;
    optimization: ListingOptimization | null;
    optimizationError: string | null;
    modelUsed: string | null;
    durationMs: number;
  };
};

export function ListingOptimizerResults({ data }: Props) {
  const { listing, pulse, optimization: opt, optimizationError, modelUsed, durationMs } = data;

  return (
    <div className="space-y-6">
      {/* Hero — pulse score + app icon */}
      <div className="rounded-lg border border-border bg-card px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {listing.iconUrl ? (
              <img
                src={listing.iconUrl}
                alt={listing.name ?? "App icon"}
                className="size-16 rounded-xl border border-border object-contain"
              />
            ) : (
              <ScoreCircle score={pulse.overallScore} />
            )}
            <div>
              <div className="flex items-center gap-3">
                <p className="text-label">Listing Pulse Score</p>
                {listing.iconUrl ? (
                  <ScoreCircle score={pulse.overallScore} size="sm" />
                ) : null}
              </div>
              <p className="mt-1 text-sm font-medium text-foreground">
                {listing.name ?? listing.handle}
              </p>
              <p className="mt-0.5 font-mono text-[0.6875rem] text-muted-foreground">
                {pulse.totalChecks} checks analysed
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-xs text-muted-foreground">
              {listing.rating ?? "—"} ⭐ · {listing.reviewCount ?? "0"} reviews
              {listing.pricing.length > 0
                ? ` · ${listing.pricing[0]}`
                : ""}
            </p>
            <a
              href={listing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[0.6875rem] text-primary hover:underline"
            >
              {listing.url}
            </a>
          </div>
        </div>
      </div>

      {/* Category score cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pulse.categories.map((cat) => (
          <CategoryCard key={cat.id} category={cat} />
        ))}
      </div>

      {/* LLM optimization — below the programmatic scores */}
      {optimizationError ? (
        <div className="rounded-lg border border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/10%)] px-4 py-3">
          <p className="text-xs text-[oklch(0.85_0.14_90)]">
            AI analysis unavailable: {optimizationError}
          </p>
        </div>
      ) : null}

      {opt ? (
        <>
          {/* AI verdict */}
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-label">AI analysis</p>
            <p className="mt-2 text-sm text-foreground">{opt.oneLiner}</p>
          </div>

          {/* Priority actions */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
            <p className="text-label text-primary">
              → Priority actions · {opt.priorityActions.length}
            </p>
            <ul className="mt-3 space-y-3">
              {opt.priorityActions.map((a, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border bg-background p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {a.title}
                    </p>
                    <div className="flex gap-1.5">
                      <ImpactPill impact={a.impact} />
                      <EffortPill effort={a.effort} />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {a.detail}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* Copy-paste rewrites */}
          <div className="grid gap-4 lg:grid-cols-2">
            <CopyBlock label="Suggested title" content={opt.suggestedTitle} />
            <CopyBlock label="Suggested tagline" content={opt.suggestedTagline} />
          </div>
          <CopyBlock label="Suggested opening hook" content={opt.suggestedHook} />

          {/* Keywords */}
          <div className="rounded-lg border border-border bg-card p-5">
            <p className="text-label">Keywords · {opt.keywords.length}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {opt.keywords.map((k, i) => (
                <span
                  key={`${k.keyword}-${i}`}
                  className={cn(
                    "rounded-md border px-2.5 py-1 font-mono text-[0.6875rem]",
                    k.status === "present"
                      ? "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] text-[oklch(0.80_0.14_160)]"
                      : "border-destructive/30 bg-destructive/10 text-destructive",
                    k.importance === "high" && "font-semibold",
                  )}
                >
                  {k.status === "missing" ? "+ " : "✓ "}
                  {k.keyword}
                </span>
              ))}
            </div>
            <p className="text-comment mt-2">
              {"// ✓ = in listing · + = missing · bold = high importance"}
            </p>
          </div>

          {/* Competitor insights */}
          {opt.competitorInsights.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-label">Competitor insights</p>
              <ul className="mt-3 space-y-3">
                {opt.competitorInsights.map((c, i) => (
                  <li key={i} className="border-l-2 border-primary/40 pl-3">
                    <p className="text-sm text-foreground">{c.insight}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="text-label">Action · </span>
                      {c.actionable}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      <p className="text-comment">
        {`// ${pulse.totalChecks} programmatic checks + ${modelUsed ? `AI via ${modelUsed}` : "no AI"} · ${(durationMs / 1000).toFixed(1)}s`}
      </p>
    </div>
  );
}

// ─── Category card ──────────────────────────────────────────────────

function CategoryCard({ category }: { category: ListingCategory }) {
  const [open, setOpen] = useState(false);
  const color = scoreColor(category.score);

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-md border border-border bg-muted text-sm">
            {category.icon}
          </span>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">
              {category.label}
            </p>
            <p className="mt-0.5 font-mono text-[0.625rem] text-muted-foreground">
              {category.checkCount} checks
            </p>
          </div>
        </div>
        <span className={cn("font-mono text-xl font-semibold", color)}>
          {category.score}
        </span>
      </button>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn(
            "h-full transition-[width] duration-300",
            category.score >= 70
              ? "bg-[oklch(0.72_0.14_160)]"
              : category.score >= 40
                ? "bg-[oklch(0.78_0.14_90)]"
                : "bg-destructive",
          )}
          style={{ width: `${category.score}%` }}
        />
      </div>

      {open ? (
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {category.checks.map((ch) => (
            <CheckRow key={ch.id} check={ch} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CheckRow({ check }: { check: ListingCheck }) {
  const glyph = { pass: "✓", warn: "■", fail: "▲" }[check.status];
  const styles = {
    pass: "text-[oklch(0.80_0.14_160)]",
    warn: "text-[oklch(0.85_0.14_90)]",
    fail: "text-destructive",
  }[check.status];

  return (
    <li className="py-2">
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5 text-[0.6875rem]", styles)} aria-hidden>
          {glyph}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-foreground">{check.label}</p>
          <p className="mt-0.5 text-[0.6875rem] leading-relaxed text-muted-foreground">
            {check.detail}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground">
          {check.weight}/{check.maxWeight}
        </span>
      </div>
    </li>
  );
}

// ─── Shared ─────────────────────────────────────────────────────────

function ScoreCircle({ score, size = "default" }: { score: number; size?: "default" | "sm" }) {
  const band =
    score >= 70
      ? "border-[oklch(0.72_0.14_160/40%)] text-[oklch(0.80_0.14_160)]"
      : score >= 40
        ? "border-[oklch(0.78_0.14_90/40%)] text-[oklch(0.85_0.14_90)]"
        : "border-destructive/40 text-destructive";
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-mono font-semibold",
        size === "sm"
          ? "size-9 border-[3px] text-xs"
          : "size-16 border-4 text-xl",
        band,
      )}
    >
      {score}
    </div>
  );
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-[oklch(0.80_0.14_160)]";
  if (score >= 40) return "text-[oklch(0.85_0.14_90)]";
  return "text-destructive";
}

function CopyBlock({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-lg border border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/5%)] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-label text-[oklch(0.80_0.14_160)]">{label}</p>
        <button
          type="button"
          onClick={copy}
          className="font-mono text-[0.625rem] uppercase tracking-wider text-primary hover:underline"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">{content}</p>
    </div>
  );
}

function ImpactPill({ impact }: { impact: string }) {
  const s: Record<string, string> = {
    high: "border-[oklch(0.72_0.14_160/30%)] text-[oklch(0.80_0.14_160)]",
    medium: "border-[oklch(0.78_0.14_90/30%)] text-[oklch(0.85_0.14_90)]",
    low: "border-border text-muted-foreground",
  };
  return (
    <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider", s[impact] ?? s.low)}>
      {impact}
    </span>
  );
}

function EffortPill({ effort }: { effort: string }) {
  return (
    <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
      {effort}
    </span>
  );
}
