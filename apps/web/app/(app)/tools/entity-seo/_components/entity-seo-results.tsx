"use client";

import { useState } from "react";

import { cn } from "@kit/ui/lib/utils";

import type {
  EntityAnalysis,
  EntityAssessment,
} from "@/lib/ai/entity-seo-analyzer";
import type { EntitySignal } from "@/lib/audit/entity-signals";

type Props = {
  data: {
    url: string;
    existingSignals: EntitySignal[];
    analysis: EntityAnalysis;
    modelUsed: string;
    durationMs: number;
  };
};

export function EntitySeoResults({ data }: Props) {
  const { url, existingSignals, analysis, modelUsed, durationMs } = data;

  return (
    <div className="space-y-6">
      <HeroCard url={url} analysis={analysis} signalCount={existingSignals.length} />

      <ActionsBlock actions={analysis.actions} />

      <EntitiesTable entities={analysis.entities} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ExistingSignalsBlock signals={existingSignals} />
        <LinkingBlock opportunities={analysis.internalLinkingOpportunities} />
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
  analysis,
  signalCount,
}: {
  url: string;
  analysis: EntityAnalysis;
  signalCount: number;
}) {
  const styles = bandStyles(scoreBand(analysis.entityAuthorityScore));
  const counts = countByDisambiguation(analysis.entities);

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
            {analysis.entityAuthorityScore}
          </div>
          <div>
            <p className="text-label">Entity authority score</p>
            <p className={cn("mt-1 text-lg font-semibold", styles.label)}>
              {bandLabel(scoreBand(analysis.entityAuthorityScore))}
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
        <span className="text-label">Primary entity · </span>
        {analysis.primaryEntity}
      </p>
      <p className="mt-2 text-sm text-foreground">{analysis.oneLiner}</p>
      <div className="mt-3 flex flex-wrap gap-3 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
        <span>{analysis.entities.length} entities analysed</span>
        <span>·</span>
        <span className="text-[oklch(0.80_0.14_160)]">{counts.clear} clear</span>
        <span>·</span>
        <span className="text-[oklch(0.85_0.14_90)]">{counts.ambiguous} ambiguous</span>
        <span>·</span>
        <span className="text-destructive">{counts.weak} weak</span>
        <span>·</span>
        <span>{signalCount} JSON-LD blocks</span>
      </div>
    </div>
  );
}

// ─── Actions ────────────────────────────────────────────────────────

function ActionsBlock({ actions }: { actions: EntityAnalysis["actions"] }) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
      <p className="text-label flex items-center gap-2 text-primary">
        → Top entity-level actions
      </p>
      <p className="text-comment mt-1">
        {"// concrete schema / linking improvements — each ~15-30 min to implement"}
      </p>
      <ul className="mt-3 space-y-3">
        {actions.map((a, i) => (
          <li
            key={i}
            className="rounded-md border border-border bg-background p-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{a.title}</p>
              {a.entity ? (
                <span className="shrink-0 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-primary">
                  {a.entity}
                </span>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {a.detail}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Per-entity table ───────────────────────────────────────────────

function EntitiesTable({
  entities,
}: {
  entities: EntityAnalysis["entities"];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">Per-entity assessment · {entities.length}</p>
      <p className="text-comment mt-1">
        {"// click any row to see the full recommendation"}
      </p>
      <ul className="mt-3 divide-y divide-border">
        {entities.map((e, i) => (
          <EntityRow key={`${e.name}-${i}`} entity={e} />
        ))}
      </ul>
    </div>
  );
}

function EntityRow({ entity }: { entity: EntityAssessment }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={open}
      >
        <DisambiguationPill status={entity.disambiguation} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-medium text-foreground">
              {entity.name}
            </span>
            <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              {entity.type}
            </span>
            <span className="font-mono text-[0.625rem] text-muted-foreground">
              · {entity.mentions} mention{entity.mentions === 1 ? "" : "s"}
            </span>
          </div>
          {!open ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {entity.importance}
            </p>
          ) : null}
        </div>
      </button>
      {open ? (
        <div className="mt-3 space-y-2 pl-9">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="text-label">Why it matters · </span>
            {entity.importance}
          </p>
          <p className="text-xs leading-relaxed text-foreground">
            <span className="text-label">Recommendation · </span>
            {entity.recommendation}
          </p>
          {entity.authoritativeUrl ? (
            <a
              href={entity.authoritativeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block font-mono text-[0.6875rem] text-primary hover:underline"
            >
              → {entity.authoritativeUrl}
            </a>
          ) : (
            <p className="font-mono text-[0.6875rem] text-muted-foreground/60">
              (no clear authoritative source for this entity)
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}

function DisambiguationPill({
  status,
}: {
  status: EntityAssessment["disambiguation"];
}) {
  const styles: Record<typeof status, string> = {
    clear:
      "border-[oklch(0.72_0.14_160/40%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
    ambiguous:
      "border-[oklch(0.78_0.14_90/40%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
    weak: "border-destructive/40 bg-destructive/10 text-destructive",
  };
  const glyph: Record<typeof status, string> = {
    clear: "✓",
    ambiguous: "?",
    weak: "▲",
  };
  return (
    <span
      title={status}
      className={cn(
        "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded border text-[0.6875rem]",
        styles[status],
      )}
      aria-hidden
    >
      {glyph[status]}
    </span>
  );
}

// ─── Existing JSON-LD signals ──────────────────────────────────────

function ExistingSignalsBlock({ signals }: { signals: EntitySignal[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">Existing entity markup · {signals.length}</p>
      <p className="text-comment mt-1">
        {"// JSON-LD blocks with entity signals on this page"}
      </p>
      {signals.length === 0 ? (
        <p className="text-comment mt-3 rounded border border-dashed border-destructive/30 bg-destructive/5 p-3 text-destructive">
          {"// no Organization / Person / Product schema found — biggest entity-SEO gap"}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {signals.map((s, i) => (
            <li
              key={`${s.name}-${i}`}
              className="rounded-md border border-border bg-background p-3"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-sm font-medium text-foreground">
                  {s.name || "(unnamed)"}
                </span>
                <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  {s.type}
                </span>
                {s.hasIdentifier ? (
                  <span className="font-mono text-[0.625rem] text-[oklch(0.80_0.14_160)]">
                    @id
                  </span>
                ) : null}
              </div>
              {s.sameAs.length > 0 ? (
                <ul className="mt-2 space-y-0.5">
                  {s.sameAs.slice(0, 5).map((url, ix) => (
                    <li
                      key={`${url}-${ix}`}
                      className="truncate font-mono text-[0.6875rem]"
                    >
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                  {s.sameAs.length > 5 ? (
                    <li className="font-mono text-[0.625rem] text-muted-foreground">
                      {`// + ${s.sameAs.length - 5} more`}
                    </li>
                  ) : null}
                </ul>
              ) : (
                <p className="text-comment mt-1">
                  {"// no sameAs URLs — add Wikipedia/Wikidata/social"}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Internal linking opportunities ─────────────────────────────────

function LinkingBlock({
  opportunities,
}: {
  opportunities: string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">Internal linking opportunities</p>
      <p className="text-comment mt-1">
        {"// entities that should link to dedicated pages on your site"}
      </p>
      {opportunities.length === 0 ? (
        <p className="text-comment mt-3">
          {"// no obvious internal-link gaps detected"}
        </p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-2">
          {opportunities.map((entity, i) => (
            <li
              key={`${entity}-${i}`}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
            >
              {entity}
            </li>
          ))}
        </ul>
      )}
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
      return "Knowledge-graph aligned";
    case "warming":
      return "Partial entity coverage";
    case "weak":
      return "Entities undefined";
  }
}

function countByDisambiguation(entities: EntityAssessment[]): {
  clear: number;
  ambiguous: number;
  weak: number;
} {
  const out = { clear: 0, ambiguous: 0, weak: 0 };
  for (const e of entities) out[e.disambiguation]++;
  return out;
}
