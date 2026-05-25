"use client";

import { cn } from "@kit/ui/lib/utils";

import type {
  GeoAnalysis,
  QueryVerdict,
} from "@/lib/ai/geo-analyzer";
import type { ExtractedContent } from "@/lib/audit/page-content";

type Props = {
  data: {
    url: string;
    content: ExtractedContent;
    analysis: GeoAnalysis;
    modelUsed: string;
    durationMs: number;
  };
};

export function GeoResults({ data }: Props) {
  const { url, content, analysis, modelUsed, durationMs } = data;

  return (
    <div className="space-y-6">
      <HeroCard url={url} content={content} analysis={analysis} />

      <SnippetPreview snippet={analysis.sampleSnippet} url={url} />

      <QueriesTable queries={analysis.queries} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ImprovementsBlock improvements={analysis.topImprovements} />
        <StrengthsBlock strengths={analysis.strengths} />
      </div>

      <p className="text-comment">
        {`// analysed in ${(durationMs / 1000).toFixed(1)}s · ${modelUsed}`}
      </p>
    </div>
  );
}

// ─── Hero ───────────────────────────────────────────────────────────

function HeroCard({
  url,
  content,
  analysis,
}: {
  url: string;
  content: ExtractedContent;
  analysis: GeoAnalysis;
}) {
  const styles = bandStyles(scoreBand(analysis.geoScore));
  const counts = countByLikelihood(analysis.queries);

  return (
    <div className="rounded-lg border border-border bg-card px-6 py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex size-16 items-center justify-center rounded-full border-4 font-mono text-xl font-semibold",
              styles.ring,
            )}
          >
            {analysis.geoScore}
          </div>
          <div>
            <p className="text-label">GEO score</p>
            <p className={cn("mt-1 text-lg font-semibold", styles.label)}>
              {bandLabel(scoreBand(analysis.geoScore))}
            </p>
          </div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-mono text-xs text-primary hover:underline"
        >
          {url}
        </a>
      </div>
      <p className="mt-4 border-t border-border pt-4 text-sm text-foreground">
        {analysis.oneLiner}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        <span>{content.wordCount} words</span>
        <span>·</span>
        <span>{analysis.queries.length} queries simulated</span>
        <span>·</span>
        <span className="text-[oklch(0.80_0.14_160)]">{counts.high} high</span>
        <span>·</span>
        <span className="text-[oklch(0.85_0.14_90)]">{counts.medium} medium</span>
        <span>·</span>
        <span className="text-destructive">{counts.low + counts.veryLow} low</span>
      </div>
    </div>
  );
}

// ─── Sample AI snippet ─────────────────────────────────────────────

function SnippetPreview({
  snippet,
  url,
}: {
  snippet: string;
  url: string;
}) {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
      <p className="text-label flex items-center gap-2 text-primary">
        ⚡ Sample AI snippet — how an LLM might quote this page
      </p>
      <blockquote className="mt-3 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed text-foreground">
        {snippet}
      </blockquote>
      <p className="text-comment mt-2">
        {`// citation source · ${host}`}
      </p>
    </div>
  );
}

// ─── Per-query table ───────────────────────────────────────────────

function QueriesTable({ queries }: { queries: GeoAnalysis["queries"] }) {
  const sorted = [...queries].sort((a, b) => b.score - a.score);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">Per-query citation likelihood</p>
      <p className="text-comment mt-1">
        {"// simulated user queries — sorted by citation chance"}
      </p>
      <ul className="mt-3 divide-y divide-border">
        {sorted.map((q, i) => (
          <QueryRow key={`${q.query}-${i}`} verdict={q} />
        ))}
      </ul>
    </div>
  );
}

function QueryRow({ verdict }: { verdict: QueryVerdict }) {
  const styles = likelihoodStyles(verdict.likelihood);

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-start gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md border font-mono text-xs font-semibold",
            styles.ring,
          )}
        >
          {verdict.score}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-sm font-medium text-foreground">
              &ldquo;{verdict.query}&rdquo;
            </p>
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider",
                styles.pill,
              )}
            >
              {verdict.likelihood.replace("-", " ")}
            </span>
            <span className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              {verdict.citationType}
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            <span className="text-label">Why · </span>
            {verdict.reasoning}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">
            <span className="text-label">To raise the score · </span>
            {verdict.missingPiece}
          </p>
        </div>
      </div>
    </li>
  );
}

// ─── Improvements ──────────────────────────────────────────────────

function ImprovementsBlock({
  improvements,
}: {
  improvements: GeoAnalysis["topImprovements"];
}) {
  return (
    <div className="rounded-lg border border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/5%)] p-5">
      <p className="text-label flex items-center gap-2 text-[oklch(0.80_0.14_160)]">
        ✓ Top GEO improvements
      </p>
      <p className="text-comment mt-1">
        {"// page-level changes that would lift the score most"}
      </p>
      <ul className="mt-3 space-y-3">
        {improvements.map((imp, i) => (
          <li
            key={i}
            className="rounded-md border border-border bg-background p-3"
          >
            <p className="text-sm font-medium text-foreground">{imp.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {imp.how}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Strengths ─────────────────────────────────────────────────────

function StrengthsBlock({ strengths }: { strengths: string[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">What's working</p>
      <p className="text-comment mt-1">
        {"// signals already pulling toward AI citation"}
      </p>
      {strengths.length === 0 ? (
        <p className="text-comment mt-3 rounded border border-dashed border-destructive/30 bg-destructive/5 p-3 text-destructive">
          {"// nothing strong yet — heavy lift to become AI-citable"}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {strengths.map((s, i) => (
            <li
              key={i}
              className="flex items-start gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground"
            >
              <span className="mt-0.5 text-[oklch(0.80_0.14_160)]" aria-hidden>
                ✓
              </span>
              <span className="flex-1 leading-relaxed">{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function scoreBand(score: number): "weak" | "warming" | "strong" {
  if (score >= 70) return "strong";
  if (score >= 40) return "warming";
  return "weak";
}

function bandStyles(band: ReturnType<typeof scoreBand>) {
  switch (band) {
    case "strong":
      return {
        ring: "border-[oklch(0.72_0.14_160/40%)] text-[oklch(0.80_0.14_160)]",
        label: "text-[oklch(0.80_0.14_160)]",
      };
    case "warming":
      return {
        ring: "border-[oklch(0.78_0.14_90/40%)] text-[oklch(0.85_0.14_90)]",
        label: "text-[oklch(0.85_0.14_90)]",
      };
    case "weak":
      return {
        ring: "border-destructive/40 text-destructive",
        label: "text-destructive",
      };
  }
}

function bandLabel(band: ReturnType<typeof scoreBand>): string {
  switch (band) {
    case "strong":
      return "Citation-ready";
    case "warming":
      return "Some citation pull";
    case "weak":
      return "Invisible to AI";
  }
}

function likelihoodStyles(likelihood: QueryVerdict["likelihood"]) {
  switch (likelihood) {
    case "high":
      return {
        ring:
          "border-[oklch(0.72_0.14_160/40%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
        pill:
          "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
      };
    case "medium":
      return {
        ring:
          "border-[oklch(0.78_0.14_90/40%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
        pill:
          "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
      };
    case "low":
    case "very-low":
      return {
        ring: "border-destructive/40 bg-destructive/10 text-destructive",
        pill: "border-destructive/30 bg-destructive/10 text-destructive",
      };
  }
}

function countByLikelihood(queries: QueryVerdict[]): {
  high: number;
  medium: number;
  low: number;
  veryLow: number;
} {
  const out = { high: 0, medium: 0, low: 0, veryLow: 0 };
  for (const q of queries) {
    if (q.likelihood === "high") out.high++;
    else if (q.likelihood === "medium") out.medium++;
    else if (q.likelihood === "low") out.low++;
    else out.veryLow++;
  }
  return out;
}
