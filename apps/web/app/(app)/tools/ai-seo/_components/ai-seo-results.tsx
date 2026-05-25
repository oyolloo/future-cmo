"use client";

import { useState } from "react";

import { cn } from "@kit/ui/lib/utils";

import type { AIVerdict } from "@/lib/ai/ai-seo-verdict";
import { AI_BOTS, type BotAccess, type RobotsReport } from "@/lib/audit/ai-bots";
import type {
  AISeoCheck,
  AISeoReport,
} from "@/lib/audit/ai-seo";

type Props = {
  data: {
    report: AISeoReport;
    verdict: AIVerdict | null;
    verdictError: string | null;
    durationMs: number;
  };
};

export function AISeoResults({ data }: Props) {
  const { report, verdict, verdictError, durationMs } = data;

  return (
    <div className="space-y-6">
      <ScoreCard report={report} verdictLine={verdict?.oneLiner ?? null} />

      {verdictError ? (
        <div className="rounded-lg border border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/10%)] px-4 py-3">
          <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-[oklch(0.85_0.14_90)]">
            AI verdict unavailable
          </p>
          <p className="mt-1 text-xs text-[oklch(0.85_0.14_90)]">
            {verdictError}
          </p>
        </div>
      ) : null}

      {verdict ? <VerdictPanel verdict={verdict} /> : null}

      <SignalsBlock checks={report.checks} />

      <BotAccessBlock
        access={report.botAccess}
        hasLlmsTxt={report.hasLlmsTxt}
      />

      <SchemasBlock schemas={report.signals.schemas} />

      <p className="text-comment">
        {`// audit ran in ${(durationMs / 1000).toFixed(1)}s · programmatic probe + OpenRouter LLM verdict`}
      </p>
    </div>
  );
}

// ─── Hero score ─────────────────────────────────────────────────────

function ScoreCard({
  report,
  verdictLine,
}: {
  report: AISeoReport;
  verdictLine: string | null;
}) {
  const styles = bandStyles(report.band);

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
            {report.score}
          </div>
          <div>
            <p className="text-label">AI-citability score</p>
            <p className={cn("mt-1 text-lg font-semibold", styles.label)}>
              {bandLabel(report.band)}
            </p>
          </div>
        </div>
        <a
          href={report.finalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-mono text-xs text-primary hover:underline"
        >
          {report.finalUrl}
        </a>
      </div>
      {verdictLine ? (
        <p className="mt-4 border-t border-border pt-4 text-sm text-foreground">
          {verdictLine}
        </p>
      ) : null}
    </div>
  );
}

// ─── LLM verdict panel ──────────────────────────────────────────────

function VerdictPanel({ verdict }: { verdict: AIVerdict }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-label flex items-center gap-2 text-destructive">
          ▲ Top issues
        </p>
        <ul className="mt-3 space-y-3">
          {verdict.issues.map((issue, i) => (
            <li key={i} className="border-l-2 border-destructive/40 pl-3">
              <p className="text-sm font-medium text-foreground">
                {issue.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {issue.why}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/8%)] p-5">
        <p className="text-label flex items-center gap-2 text-[oklch(0.80_0.14_160)]">
          ✓ Improvements
        </p>
        <ul className="mt-3 space-y-3">
          {verdict.improvements.map((imp, i) => (
            <li
              key={i}
              className="border-l-2 border-[oklch(0.72_0.14_160/40%)] pl-3"
            >
              <p className="text-sm font-medium text-foreground">{imp.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {imp.how}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 lg:col-span-2">
        <p className="text-label">Queries this page could be cited for</p>
        <p className="text-comment mt-1">
          {"// natural-language searches users type into ChatGPT / Perplexity"}
        </p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {verdict.potentialQueries.map((q, i) => (
            <li
              key={i}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground"
            >
              {q}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Signals checklist ─────────────────────────────────────────────

function SignalsBlock({ checks }: { checks: AISeoCheck[] }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-label">Signals · {checks.length} checks</p>
      <ul className="mt-4 divide-y divide-border">
        {checks.map((c) => (
          <SignalRow key={c.id} check={c} />
        ))}
      </ul>
    </div>
  );
}

function SignalRow({ check }: { check: AISeoCheck }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={open}
      >
        <StatusIcon status={check.status} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{check.label}</p>
          {!open ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {check.detail}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground">
          {check.weight}/{check.maxWeight}
        </span>
      </button>
      {open ? (
        <p className="mt-2 pl-7 text-xs leading-relaxed text-muted-foreground">
          {check.detail}
        </p>
      ) : null}
    </li>
  );
}

function StatusIcon({ status }: { status: AISeoCheck["status"] }) {
  const styles: Record<typeof status, string> = {
    pass: "border-[oklch(0.72_0.14_160/40%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
    warn: "border-[oklch(0.78_0.14_90/40%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
    fail: "border-destructive/40 bg-destructive/10 text-destructive",
    info: "border-border bg-muted text-muted-foreground",
  };
  const glyph: Record<typeof status, string> = {
    pass: "✓",
    warn: "■",
    fail: "▲",
    info: "○",
  };
  return (
    <span
      className={cn(
        "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-md border text-[0.625rem]",
        styles[status],
      )}
      aria-hidden
    >
      {glyph[status]}
    </span>
  );
}

// ─── Bot access ──────────────────────────────────────────────────────

function BotAccessBlock({
  access,
  hasLlmsTxt,
}: {
  access: RobotsReport;
  hasLlmsTxt: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label">AI crawler access</p>
        <span
          className={cn(
            "rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider",
            hasLlmsTxt
              ? "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]"
              : "border-border bg-muted/40 text-muted-foreground",
          )}
        >
          llms.txt {hasLlmsTxt ? "✓" : "✗"}
        </span>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {AI_BOTS.map((bot) => (
          <li
            key={bot}
            className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2"
          >
            <span className="font-mono text-[0.6875rem] text-foreground">
              {bot}
            </span>
            <BotPill access={access[bot]} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function BotPill({ access }: { access: BotAccess }) {
  const styles: Record<BotAccess, string> = {
    allow:
      "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
    disallow: "border-destructive/30 bg-destructive/10 text-destructive",
    "no-rule": "border-border bg-muted/40 text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "rounded-md border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider",
        styles[access],
      )}
    >
      {access === "no-rule" ? "—" : access}
    </span>
  );
}

// ─── Schemas detected ───────────────────────────────────────────────

function SchemasBlock({
  schemas,
}: {
  schemas: AISeoReport["signals"]["schemas"];
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-label">JSON-LD schemas · {schemas.length} found</p>
      {schemas.length === 0 ? (
        <p className="text-comment mt-3">
          {"// no JSON-LD on the page — biggest single AI-citability gap"}
        </p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {schemas.map((s, i) => (
            <li
              key={`${s.type}-${i}`}
              className="rounded-md border border-border bg-background p-3"
            >
              <p className="font-mono text-xs text-foreground">{s.type}</p>
              <p className="mt-1.5 flex flex-wrap gap-1">
                {(
                  [
                    ["author", s.hasAuthor],
                    ["dateModified", s.hasDateModified],
                    ["mainEntityOfPage", s.hasMainEntityOfPage],
                    ["sameAs", s.hasSameAs],
                  ] as const
                ).map(([field, has]) => (
                  <span
                    key={field}
                    className={cn(
                      "rounded border px-1.5 py-0.5 font-mono text-[0.625rem]",
                      has
                        ? "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] text-[oklch(0.80_0.14_160)]"
                        : "border-border bg-muted/40 text-muted-foreground/60",
                    )}
                  >
                    {has ? "✓" : "✗"} {field}
                  </span>
                ))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function bandStyles(band: AISeoReport["band"]) {
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

function bandLabel(band: AISeoReport["band"]): string {
  switch (band) {
    case "strong":
      return "AI-ready";
    case "warming":
      return "Needs work";
    case "weak":
      return "Invisible to AI";
  }
}
