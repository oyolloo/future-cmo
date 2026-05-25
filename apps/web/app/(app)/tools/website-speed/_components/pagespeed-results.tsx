"use client";

import { useState } from "react";

import { cn } from "@kit/ui/lib/utils";

import type {
  PagespeedAudit,
  PagespeedCategory,
  PagespeedCategoryGroup,
  PagespeedDetails,
  PagespeedLoadingExperience,
  PagespeedMetric,
} from "@/lib/audit/pagespeed-details";

import { AuditItemsTable } from "./audit-items-table";

export function PagespeedResults({ data }: { data: PagespeedDetails }) {
  return (
    <div className="space-y-8">
      <UrlBar finalUrl={data.finalUrl} strategy={data.strategy} />

      {data.runtimeError ? (
        <RuntimeErrorBanner error={data.runtimeError} />
      ) : null}
      {data.runWarnings.length > 0 ? (
        <RunWarningsBanner warnings={data.runWarnings} />
      ) : null}

      <CategoryNav categories={data.categories} />

      {data.fieldData ? <FieldData experience={data.fieldData} /> : null}

      <MetricsBlock metrics={data.metrics} screenshot={data.screenshot} />

      {data.categories.map((cat) => (
        <CategorySection key={cat.id} category={cat} />
      ))}

      <p className="text-comment">
        {`// lighthouse v${data.lighthouseVersion} · ${new Date(
          data.fetchedAt,
        ).toLocaleString()}`}
      </p>
    </div>
  );
}

// ─── Header bits ─────────────────────────────────────────────────────

function UrlBar({
  finalUrl,
  strategy,
}: {
  finalUrl: string;
  strategy: "mobile" | "desktop";
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <a
        href={finalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate font-mono text-xs text-primary hover:underline"
      >
        {finalUrl}
      </a>
      <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        {strategy}
      </span>
    </div>
  );
}

function RuntimeErrorBanner({
  error,
}: {
  error: { code: string; message: string };
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
      <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-destructive">
        Lighthouse runtime error · {error.code}
      </p>
      <p className="mt-2 text-sm text-destructive">{error.message}</p>
    </div>
  );
}

function RunWarningsBanner({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-lg border border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/10%)] p-4">
      <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-[oklch(0.85_0.14_90)]">
        Issues affecting this run
      </p>
      <ul className="mt-2 space-y-1 text-sm text-[oklch(0.85_0.14_90)]">
        {warnings.map((w, i) => (
          <li key={i} className="leading-relaxed">
            {w}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Category nav (the 4 score circles) ─────────────────────────────

function CategoryNav({ categories }: { categories: PagespeedCategory[] }) {
  return (
    <nav
      aria-label="Lighthouse categories"
      className="sticky top-14 z-10 rounded-lg border border-border bg-card/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/75"
    >
      <ul className="flex flex-wrap items-center justify-around gap-4 sm:justify-center sm:gap-10">
        {categories.map((cat) => (
          <li key={cat.id}>
            <a
              href={`#category-${cat.id}`}
              className="group flex flex-col items-center gap-1.5 text-center"
            >
              <ScoreCircle score={cat.score} size="md" />
              <span className="text-xs font-medium text-foreground group-hover:text-primary">
                {cat.title}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function ScoreCircle({
  score,
  size,
}: {
  score: number | null;
  size: "md" | "lg";
}) {
  const band = scoreBand(score);
  const ring = bandRing(band);
  const sizeClass = size === "lg" ? "size-20 text-2xl border-4" : "size-12 text-sm border-2";
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-mono font-semibold",
        sizeClass,
        ring,
      )}
    >
      {score ?? "—"}
    </div>
  );
}

// ─── Field data (CrUX) ───────────────────────────────────────────────

function FieldData({ experience }: { experience: PagespeedLoadingExperience }) {
  if (experience.metrics.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-label">Field data · 28-day real-user origin</p>
        {experience.category ? (
          <CategoryPill category={experience.category} />
        ) : null}
      </div>
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {experience.metrics.map((m) => (
          <li
            key={m.id}
            className="rounded-md border border-border bg-background p-3"
          >
            <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              {m.label}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="font-mono text-base text-foreground">
                {m.percentile != null ? formatCruxValue(m.id, m.percentile) : "—"}
              </span>
              {m.category ? (
                <CategoryPill category={m.category} subtle />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryPill({
  category,
  subtle = false,
}: {
  category: "FAST" | "AVERAGE" | "SLOW";
  subtle?: boolean;
}) {
  const styles: Record<typeof category, string> = {
    FAST: subtle
      ? "text-[oklch(0.80_0.14_160)]"
      : "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
    AVERAGE: subtle
      ? "text-[oklch(0.85_0.14_90)]"
      : "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
    SLOW: subtle
      ? "text-destructive"
      : "border-destructive/30 bg-destructive/10 text-destructive",
  };
  return (
    <span
      className={cn(
        "rounded-md font-mono text-[0.625rem] uppercase tracking-wider",
        subtle ? "" : "border px-2 py-0.5",
        styles[category],
      )}
    >
      {category.toLowerCase()}
    </span>
  );
}

// ─── Lab metrics + screenshot ───────────────────────────────────────

function MetricsBlock({
  metrics,
  screenshot,
}: {
  metrics: PagespeedMetric[];
  screenshot: string | null;
}) {
  const hasMetrics = metrics.length > 0;
  if (!hasMetrics && !screenshot) return null;

  // Two-column layout only when we have BOTH. If one is missing, render the
  // present one full-width and the screenshot stays a constrained thumbnail
  // so it can't stretch into a huge blend-into-page strip.
  if (!hasMetrics) {
    return screenshot ? (
      <div className="flex justify-start">
        <ScreenshotCard dataUri={screenshot} />
      </div>
    ) : null;
  }

  if (!screenshot) {
    return <MetricsCard metrics={metrics} />;
  }

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_280px]">
      <MetricsCard metrics={metrics} />
      <ScreenshotCard dataUri={screenshot} />
    </div>
  );
}

function MetricsCard({ metrics }: { metrics: PagespeedMetric[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-label">Lab metrics · this run</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <li
            key={m.id}
            className="rounded-md border border-border bg-background p-3"
          >
            <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              {m.title}
            </p>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={cn(
                  "font-mono text-base font-medium",
                  metricColor(m.score),
                )}
              >
                {m.displayValue}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScreenshotCard({ dataUri }: { dataUri: string }) {
  return (
    <div className="w-full max-w-[280px] self-start rounded-lg border border-border bg-card p-4">
      <p className="text-label">Page screenshot</p>
      <p className="text-comment mt-1">{"// captured by Lighthouse"}</p>
      {/* Aspect-ratio container + bounded height keeps the card a small
          thumbnail even when the source screenshot is 412 × 8000 px. */}
      <div className="mt-3 aspect-[9/16] max-h-[360px] w-full overflow-auto rounded border border-border bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUri}
          alt="Rendered viewport"
          className="block w-full"
        />
      </div>
    </div>
  );
}

// ─── Category section ───────────────────────────────────────────────

function CategorySection({ category }: { category: PagespeedCategory }) {
  const hasFindings = category.groups.length > 0;
  return (
    <section
      id={`category-${category.id}`}
      className="scroll-mt-32 rounded-lg border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <ScoreCircle score={category.score} size="lg" />
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {category.title}
            </h2>
            {category.description ? (
              <p
                className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: category.description }}
              />
            ) : null}
          </div>
        </div>
        <CategoryCounts category={category} />
      </div>

      {hasFindings ? (
        <div className="mt-6 space-y-6">
          {category.groups.map((group) => (
            <CategoryGroupBlock key={group.id} group={group} />
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-md border border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] px-4 py-3">
          <p className="font-mono text-xs text-[oklch(0.80_0.14_160)]">
            ✓ No active findings in this category — see passed audits below.
          </p>
        </div>
      )}

      <BucketCollapsible
        title="Passed audits"
        count={category.passed.length}
        audits={category.passed}
        kind="passed"
      />
      <BucketCollapsible
        title="Items to manually verify"
        count={category.manual.length}
        audits={category.manual}
        kind="manual"
      />
      <BucketCollapsible
        title="Not applicable"
        count={category.notApplicable.length}
        audits={category.notApplicable}
        kind="na"
      />
    </section>
  );
}

function CategoryCounts({ category }: { category: PagespeedCategory }) {
  const findings = category.groups.reduce(
    (sum, g) => sum + g.audits.length,
    0,
  );
  return (
    <div className="flex flex-wrap items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-wider">
      <CountPill label="findings" count={findings} tone="warn" />
      <CountPill label="passed" count={category.passed.length} tone="ok" />
      {category.manual.length > 0 ? (
        <CountPill label="manual" count={category.manual.length} tone="info" />
      ) : null}
      {category.notApplicable.length > 0 ? (
        <CountPill label="n/a" count={category.notApplicable.length} tone="muted" />
      ) : null}
    </div>
  );
}

function CountPill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "ok" | "warn" | "info" | "muted";
}) {
  const styles: Record<typeof tone, string> = {
    ok: "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
    warn: "border-destructive/30 bg-destructive/10 text-destructive",
    info: "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
    muted: "border-border bg-muted/40 text-muted-foreground",
  };
  return (
    <span
      className={cn("rounded-md border px-2 py-0.5", styles[tone])}
    >
      {count} {label}
    </span>
  );
}

// ─── Group block (Insights, Diagnostics, Navigation, etc.) ──────────

function CategoryGroupBlock({ group }: { group: PagespeedCategoryGroup }) {
  return (
    <div>
      <div className="border-b border-border pb-2">
        <h3 className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
          {group.title} · {group.audits.length}
        </h3>
        {group.description ? (
          <p
            className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground/80 [&_a]:text-primary [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: group.description }}
          />
        ) : null}
      </div>
      <ul className="divide-y divide-border">
        {group.audits.map((a) => (
          <AuditRow key={a.id} audit={a} />
        ))}
      </ul>
    </div>
  );
}

// ─── Audit row (the expandable per-audit detail) ────────────────────

function AuditRow({ audit }: { audit: PagespeedAudit }) {
  const [open, setOpen] = useState(false);
  const tone = auditSeverity(audit);

  return (
    <li className="py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={open}
      >
        <SeverityIcon tone={tone} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{audit.title}</p>
          <AuditMeta audit={audit} />
        </div>
        <RightBadge audit={audit} />
      </button>
      {open ? (
        <div className="mt-3 pl-7">
          <p
            className="text-xs leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: audit.description }}
          />
          <AuditItemsTable headings={audit.headings} items={audit.items} />
        </div>
      ) : null}
    </li>
  );
}

function AuditMeta({ audit }: { audit: PagespeedAudit }) {
  const parts: string[] = [];
  if (audit.savingsBytes > 0) {
    parts.push(`${formatBytes(audit.savingsBytes)} potential reduction`);
  }
  if (audit.items.length > 0) {
    parts.push(
      `${audit.items.length} affected resource${audit.items.length === 1 ? "" : "s"}`,
    );
  }
  if (parts.length === 0) return null;
  return <p className="text-comment mt-1">{`// ${parts.join(" · ")}`}</p>;
}

function RightBadge({ audit }: { audit: PagespeedAudit }) {
  if (audit.savingsMs > 0) {
    return (
      <span className="shrink-0 rounded-md border border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/15%)] px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-[oklch(0.85_0.14_90)]">
        ~{Math.round(audit.savingsMs)} ms
      </span>
    );
  }
  if (audit.displayValue) {
    return (
      <span className="shrink-0 font-mono text-xs text-muted-foreground">
        {audit.displayValue}
      </span>
    );
  }
  return null;
}

type Severity = "fail" | "warn" | "info" | "pass";

function auditSeverity(audit: PagespeedAudit): Severity {
  if (audit.scoreDisplayMode === "manual") return "info";
  if (audit.score == null) return "info";
  if (audit.score < 0.5) return "fail";
  if (audit.score < 0.9) return "warn";
  return "pass";
}

function SeverityIcon({ tone }: { tone: Severity }) {
  const styles: Record<Severity, string> = {
    fail: "border-destructive/40 bg-destructive/10 text-destructive",
    warn: "border-[oklch(0.78_0.14_90/40%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
    info: "border-border bg-muted text-muted-foreground",
    pass: "border-[oklch(0.72_0.14_160/40%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
  };
  const glyph: Record<Severity, string> = {
    fail: "▲",
    warn: "■",
    info: "○",
    pass: "✓",
  };
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-md border text-[0.625rem]",
        styles[tone],
      )}
      aria-hidden
    >
      {glyph[tone]}
    </span>
  );
}

// ─── Passed / Manual / N/A buckets (collapsible) ────────────────────

function BucketCollapsible({
  title,
  count,
  audits,
  kind,
}: {
  title: string;
  count: number;
  audits: PagespeedAudit[];
  kind: "passed" | "manual" | "na";
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;

  return (
    <div className="mt-6 border-t border-border pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3"
        aria-expanded={open}
      >
        <span className="text-label">
          {title} · {count}
        </span>
        <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
          {open ? "hide" : "show"}
        </span>
      </button>
      {open ? (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {audits.map((a) => (
            <li
              key={a.id}
              className="rounded-md border border-border bg-background px-3 py-2"
            >
              <div className="flex items-start gap-2">
                <SeverityIcon tone={kind === "passed" ? "pass" : "info"} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">
                    {a.title}
                  </p>
                  {a.displayValue ? (
                    <p className="mt-0.5 font-mono text-[0.6875rem] text-muted-foreground">
                      {a.displayValue}
                    </p>
                  ) : null}
                </div>
              </div>
              {kind !== "passed" ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[0.6875rem] text-muted-foreground hover:text-foreground">
                    details
                  </summary>
                  <p
                    className="mt-1.5 text-[0.6875rem] leading-relaxed text-muted-foreground [&_a]:text-primary [&_a]:underline"
                    dangerouslySetInnerHTML={{ __html: a.description }}
                  />
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function scoreBand(score: number | null): "weak" | "warming" | "strong" | "unknown" {
  if (score == null) return "unknown";
  if (score >= 90) return "strong";
  if (score >= 50) return "warming";
  return "weak";
}

function bandRing(band: ReturnType<typeof scoreBand>) {
  switch (band) {
    case "strong":
      return "border-[oklch(0.72_0.14_160/40%)] text-[oklch(0.80_0.14_160)]";
    case "warming":
      return "border-[oklch(0.78_0.14_90/40%)] text-[oklch(0.85_0.14_90)]";
    case "weak":
      return "border-destructive/40 text-destructive";
    case "unknown":
      return "border-border text-muted-foreground";
  }
}

function metricColor(score: number): string {
  if (score >= 0.9) return "text-[oklch(0.80_0.14_160)]";
  if (score >= 0.5) return "text-[oklch(0.85_0.14_90)]";
  return "text-destructive";
}

function formatCruxValue(id: string, percentile: number): string {
  if (id === "CUMULATIVE_LAYOUT_SHIFT_SCORE") {
    return (percentile / 100).toFixed(3);
  }
  if (percentile >= 1000) return `${(percentile / 1000).toFixed(1)} s`;
  return `${Math.round(percentile)} ms`;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}
