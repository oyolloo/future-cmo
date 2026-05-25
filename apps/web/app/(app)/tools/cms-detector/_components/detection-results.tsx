"use client";

import { useState } from "react";

import { cn } from "@kit/ui/lib/utils";

import type {
  DetectedTech,
  TechDetectionResult,
} from "@/lib/audit/tech-detector";

const UNCATEGORISED = "Other";

export function DetectionResults({ data }: { data: TechDetectionResult }) {
  const grouped = groupByCategory(data.detected, data.categoryPriority);
  const categoryNames = [...grouped.keys()];

  return (
    <div className="space-y-6">
      <Summary data={data} categoryCount={categoryNames.length} />

      {categoryNames.length === 0 ? (
        <EmptyResult />
      ) : (
        <div className="space-y-6">
          {categoryNames.map((cat) => (
            <CategoryBlock
              key={cat}
              category={cat}
              techs={grouped.get(cat) ?? []}
            />
          ))}
        </div>
      )}

      <HeadersBlock headers={data.headers} />

      <p className="text-comment">
        {`// detection ran in ${(data.durationMs / 1000).toFixed(2)}s · powered by Wappalyzer fingerprint DB`}
      </p>
    </div>
  );
}

// ─── Summary ─────────────────────────────────────────────────────────

function Summary({
  data,
  categoryCount,
}: {
  data: TechDetectionResult;
  categoryCount: number;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href={data.finalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-mono text-xs text-primary hover:underline"
        >
          {data.finalUrl}
        </a>
        <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
          HTTP {data.statusCode}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SummaryPill label="technologies" count={data.detected.length} />
        <SummaryPill label="categories" count={categoryCount} />
        {data.language ? (
          <span className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
            lang · {data.language}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SummaryPill({ label, count }: { label: string; count: number }) {
  return (
    <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-primary">
      {count} {label}
    </span>
  );
}

function EmptyResult() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center">
      <p className="text-sm text-muted-foreground">
        No technologies detected.
      </p>
      <p className="text-comment mt-2">
        {"// the site may be entirely server-rendered with no recognisable signals — try the deepest content page"}
      </p>
    </div>
  );
}

// ─── Per-category section ───────────────────────────────────────────

function CategoryBlock({
  category,
  techs,
}: {
  category: string;
  techs: DetectedTech[];
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-baseline gap-3 border-b border-border pb-3">
        <h2 className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
          {category}
        </h2>
        <span className="font-mono text-xs text-muted-foreground/70">
          · {techs.length} detected
        </span>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {techs.map((t) => (
          <li key={`${category}__${t.name}`}>
            <TechCard tech={t} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function TechCard({ tech }: { tech: DetectedTech }) {
  const inner = (
    <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3 transition-colors hover:border-primary/40">
      <TechIcon icon={tech.icon} name={tech.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {tech.name}
          </p>
          {tech.version ? (
            <span className="shrink-0 rounded border border-border bg-muted/40 px-1 py-px font-mono text-[0.625rem] text-muted-foreground">
              v{tech.version}
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-2">
          <ConfidenceBar value={tech.confidence} />
          <span className="font-mono text-[0.625rem] text-muted-foreground">
            {tech.confidence}%
          </span>
        </div>
      </div>
    </div>
  );

  return tech.website ? (
    <a
      href={tech.website}
      target="_blank"
      rel="noopener noreferrer"
      className="block"
      title={`${tech.name} — ${tech.website}`}
    >
      {inner}
    </a>
  ) : (
    inner
  );
}

function TechIcon({ icon, name }: { icon: string | null; name: string }) {
  const [errored, setErrored] = useState(false);

  if (!icon || errored) {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted font-mono text-[0.625rem] uppercase text-muted-foreground">
        {name.slice(0, 2)}
      </span>
    );
  }

  // Wappalyzer icons live on the upstream CDN; we don't bundle them. Most
  // are SVGs and small (<5 KB) so unoptimised is fine. PNGs work too.
  const src = `https://www.wappalyzer.com/images/icons/${icon}`;
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={src}
      alt={name}
      width={32}
      height={32}
      onError={() => setErrored(true)}
      className="size-8 shrink-0 rounded-md border border-border bg-background object-contain p-1"
    />
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const tone =
    clamped >= 75
      ? "bg-[oklch(0.72_0.14_160)]"
      : clamped >= 40
        ? "bg-[oklch(0.78_0.14_90)]"
        : "bg-destructive";

  return (
    <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/60">
      <div
        className={cn("h-full transition-[width] duration-200", tone)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

// ─── Response headers (collapsible) ─────────────────────────────────

function HeadersBlock({ headers }: { headers: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(headers).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  if (entries.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3"
        aria-expanded={open}
      >
        <span className="text-label">
          Response headers · {entries.length}
        </span>
        <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
          {open ? "hide" : "show"}
        </span>
      </button>
      {open ? (
        <div className="mt-4 overflow-hidden rounded-md border border-border bg-background">
          <table className="w-full text-xs">
            <tbody>
              {entries.map(([key, value]) => (
                <tr
                  key={key}
                  className="border-b border-border last:border-b-0"
                >
                  <td className="w-1/3 max-w-[28ch] truncate px-3 py-2 font-mono text-[0.6875rem] text-muted-foreground">
                    {key}
                  </td>
                  <td className="px-3 py-2 font-mono text-[0.6875rem] text-foreground break-all">
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Group detections by category. A single tech can appear in multiple
 * categories (e.g. Shopify is both "CMS" and "Ecommerce"); we duplicate
 * it across each so users see it under every relevant heading.
 *
 * Ordering: Wappalyzer category priority ascending (lower = more
 * important — CMS / Ecommerce = 1, CDN / Security = 9, Miscellaneous
 * = 10). Ties broken by group size desc, then name asc. "Other"
 * (uncategorised) always last.
 */
function groupByCategory(
  techs: DetectedTech[],
  priority: Record<string, number>,
): Map<string, DetectedTech[]> {
  const counts = new Map<string, DetectedTech[]>();
  for (const tech of techs) {
    const cats = tech.categories.length > 0 ? tech.categories : [UNCATEGORISED];
    for (const cat of cats) {
      const list = counts.get(cat);
      if (list) list.push(tech);
      else counts.set(cat, [tech]);
    }
  }

  const prioOf = (name: string): number => {
    if (name === UNCATEGORISED) return 999;
    return priority[name] ?? 10;
  };

  return new Map(
    [...counts.entries()].sort((a, b) => {
      const pa = prioOf(a[0]);
      const pb = prioOf(b[0]);
      if (pa !== pb) return pa - pb;
      if (a[1].length !== b[1].length) return b[1].length - a[1].length;
      return a[0].localeCompare(b[0]);
    }),
  );
}
