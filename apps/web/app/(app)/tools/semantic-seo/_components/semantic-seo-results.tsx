"use client";

import { cn } from "@kit/ui/lib/utils";

import type { SemanticAnalysis } from "@/lib/ai/semantic-seo-analyzer";
import type { ExtractedContent } from "@/lib/audit/page-content";

type Props = {
  data: {
    url: string;
    content: ExtractedContent;
    analysis: SemanticAnalysis;
    modelUsed: string;
    durationMs: number;
  };
};

export function SemanticSeoResults({ data }: Props) {
  const { url, content, analysis, modelUsed, durationMs } = data;

  return (
    <div className="space-y-6">
      <HeroCard url={url} content={content} analysis={analysis} />

      <div className="grid gap-4 lg:grid-cols-2">
        <EntitiesBlock entities={analysis.coveredEntities} />
        <MissingBlock missing={analysis.missingEntities} />
      </div>

      <SuggestionsBlock suggestions={analysis.suggestedAdditions} />

      <QueriesBlock queries={analysis.relatedQueries} />

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
  analysis: SemanticAnalysis;
}) {
  const styles = bandStyles(scoreBand(analysis.topicalDepthScore));

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
            {analysis.topicalDepthScore}
          </div>
          <div>
            <p className="text-label">Topical depth score</p>
            <p className={cn("mt-1 text-lg font-semibold", styles.label)}>
              {bandLabel(scoreBand(analysis.topicalDepthScore))}
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
        <span className="text-label">Main topic · </span>
        {analysis.mainTopic}
      </p>
      <p className="mt-2 text-sm text-foreground">{analysis.oneLiner}</p>
      <div className="mt-3 flex flex-wrap gap-3 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        <span>{content.wordCount} words</span>
        <span>·</span>
        <span>{content.headings.length} headings</span>
        <span>·</span>
        <span>{analysis.coveredEntities.length} entities covered</span>
        <span>·</span>
        <span className="text-destructive">
          {analysis.missingEntities.length} missing
        </span>
      </div>
    </div>
  );
}

// ─── Entities covered ───────────────────────────────────────────────

function EntitiesBlock({
  entities,
}: {
  entities: SemanticAnalysis["coveredEntities"];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">Entities covered · {entities.length}</p>
      <p className="text-comment mt-1">
        {"// detected on this page · sorted by importance"}
      </p>
      <ul className="mt-3 space-y-1.5">
        {entities
          .slice()
          .sort((a, b) => importanceRank(a.importance) - importanceRank(b.importance))
          .map((e, i) => (
            <li
              key={`${e.name}-${i}`}
              className="flex items-center gap-2 py-1"
            >
              <ImportancePill importance={e.importance} />
              <span className="truncate text-sm text-foreground">{e.name}</span>
              <span className="ml-auto shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                {e.type}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}

function ImportancePill({
  importance,
}: {
  importance: SemanticAnalysis["coveredEntities"][number]["importance"];
}) {
  const styles: Record<typeof importance, string> = {
    primary:
      "border-primary/40 bg-primary/15 text-primary",
    supporting:
      "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] text-[oklch(0.80_0.14_160)]",
    incidental: "border-border bg-muted/40 text-muted-foreground",
  };
  const label: Record<typeof importance, string> = {
    primary: "P",
    supporting: "S",
    incidental: "·",
  };
  return (
    <span
      title={importance}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded border font-mono text-[0.625rem]",
        styles[importance],
      )}
    >
      {label[importance]}
    </span>
  );
}

// ─── Missing entities ───────────────────────────────────────────────

function MissingBlock({
  missing,
}: {
  missing: SemanticAnalysis["missingEntities"];
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
      <p className="text-label flex items-center gap-2 text-destructive">
        ▲ Missing entities · {missing.length}
      </p>
      <p className="text-comment mt-1">
        {"// topically relevant but absent from the page"}
      </p>
      {missing.length === 0 ? (
        <p className="text-comment mt-3">
          {"// no critical gaps — strong topical coverage"}
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {missing.map((e, i) => (
            <li
              key={`${e.name}-${i}`}
              className="border-l-2 border-destructive/40 pl-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-foreground">
                  {e.name}
                </span>
                <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  {e.type}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {e.why}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Suggestions ────────────────────────────────────────────────────

function SuggestionsBlock({
  suggestions,
}: {
  suggestions: SemanticAnalysis["suggestedAdditions"];
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="rounded-lg border border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/5%)] p-5">
      <p className="text-label flex items-center gap-2 text-[oklch(0.80_0.14_160)]">
        ✓ Suggested additions · {suggestions.length}
      </p>
      <p className="text-comment mt-1">
        {"// concrete content additions to close topical gaps"}
      </p>
      <ul className="mt-3 space-y-4">
        {suggestions.map((s, i) => (
          <li
            key={i}
            className="rounded-md border border-border bg-background p-3"
          >
            <p className="text-sm font-medium text-foreground">{s.topic}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              <span className="text-label">Why · </span>
              {s.why}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground">
              <span className="text-label">Angle · </span>
              {s.sampleAngle}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Related queries ───────────────────────────────────────────────

function QueriesBlock({
  queries,
}: {
  queries: SemanticAnalysis["relatedQueries"];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">Related queries</p>
      <p className="text-comment mt-1">
        {"// natural-language searches this page could rank for once expanded"}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {queries.map((q, i) => (
          <li
            key={i}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
          >
            {q}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function scoreBand(score: number): "weak" | "warming" | "strong" {
  if (score >= 75) return "strong";
  if (score >= 45) return "warming";
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
      return "Topically deep";
    case "warming":
      return "Partial coverage";
    case "weak":
      return "Thin on the topic";
  }
}

function importanceRank(
  importance: SemanticAnalysis["coveredEntities"][number]["importance"],
): number {
  switch (importance) {
    case "primary":
      return 0;
    case "supporting":
      return 1;
    case "incidental":
      return 2;
  }
}
