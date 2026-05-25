"use client";

import { cn } from "@kit/ui/lib/utils";

import type { CompetitorSummary } from "@/lib/ai/competitor-summary";
import type { CompetitorResult } from "@/lib/audit/competitor-analysis";

type Props = {
  data: {
    results: CompetitorResult[];
    summary: CompetitorSummary | null;
    summaryError: string | null;
    durationMs: number;
  };
};

export function CompetitorResults({ data }: Props) {
  const { results, summary, summaryError, durationMs } = data;

  return (
    <div className="space-y-6">
      {summary ? <SummaryPanel summary={summary} /> : null}
      {summaryError ? (
        <div className="rounded-lg border border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/10%)] px-4 py-3">
          <p className="text-xs text-[oklch(0.85_0.14_90)]">
            AI summary unavailable: {summaryError}
          </p>
        </div>
      ) : null}

      <ComparisonTable results={results} />

      {summary?.quickWins ? (
        <QuickWinsPanel wins={summary.quickWins} />
      ) : null}

      <p className="text-comment">
        {`// ${results.length} sites audited in ${(durationMs / 1000).toFixed(1)}s`}
      </p>
    </div>
  );
}

// ─── LLM Summary ───────────────────────────────────────────────────

function SummaryPanel({ summary }: { summary: CompetitorSummary }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">AI comparison verdict</p>
      <p className="mt-2 text-sm font-medium text-foreground">
        {summary.oneLiner}
      </p>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {summary.overview}
      </p>
      {summary.verdicts.length > 0 ? (
        <ul className="mt-4 divide-y divide-border">
          {summary.verdicts.map((v) => (
            <li
              key={v.domain}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2"
            >
              <span className="text-sm font-medium text-primary">
                {v.domain}
              </span>
              <span className="text-xs text-muted-foreground">
                {v.verdict}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─── Comparison table ──────────────────────────────────────────────

function ComparisonTable({ results }: { results: CompetitorResult[] }) {
  const rows: Array<{
    label: string;
    values: Array<{ text: string; tone: "ok" | "warn" | "fail" | "neutral" }>;
  }> = [
    {
      label: "Performance (mobile)",
      values: results.map((r) => {
        const s = r.speed?.mobile?.categories.find(c => c.id === "performance")?.score ?? null;
        return scoreCell(s);
      }),
    },
    {
      label: "Performance (desktop)",
      values: results.map((r) => {
        const s = r.speed?.desktop?.categories.find(c => c.id === "performance")?.score ?? null;
        return scoreCell(s);
      }),
    },
    {
      label: "Mobile-friendliness",
      values: results.map((r) => scoreCell(r.mobileFriendly?.score ?? null)),
    },
    {
      label: "AI SEO",
      values: results.map((r) => scoreCell(r.aiSeo?.score ?? null)),
    },
    {
      label: "CMS / Platform",
      values: results.map((r) => {
        const cms = r.techStack?.detected.find((t) =>
          t.categories.some((c) => /CMS|Ecommerce/i.test(c)),
        );
        return { text: cms?.name ?? "—", tone: "neutral" as const };
      }),
    },
    {
      label: "Tech count",
      values: results.map((r) => ({
        text: r.techStack ? String(r.techStack.detected.length) : "—",
        tone: "neutral" as const,
      })),
    },
    {
      label: "Hosting",
      values: results.map((r) => ({
        text: r.domainInfo?.hosting?.org ?? "—",
        tone: "neutral" as const,
      })),
    },
    {
      label: "Domain expiry",
      values: results.map((r) => {
        const d = r.domainInfo?.daysToExpiry;
        if (d == null) return { text: "—", tone: "neutral" as const };
        return {
          text: `${d}d`,
          tone: d < 30 ? "fail" : d < 90 ? "warn" : "ok",
        };
      }),
    },
    {
      label: "SPF",
      values: results.map((r) => ({
        text: r.domainInfo?.hasSpf ? "✓" : "✗",
        tone: r.domainInfo?.hasSpf ? "ok" : "fail",
      })),
    },
    {
      label: "DMARC",
      values: results.map((r) => ({
        text: r.domainInfo?.hasDmarc ? "✓" : "✗",
        tone: r.domainInfo?.hasDmarc ? "ok" : "fail",
      })),
    },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="text-label px-4 py-2.5 text-left">Metric</th>
            {results.map((r) => (
              <th
                key={r.url}
                className="text-label min-w-[140px] px-4 py-2.5 text-left"
              >
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {r.domain}
                </a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className="border-b border-border last:border-b-0"
            >
              <td className="px-4 py-2.5 text-muted-foreground">
                {row.label}
              </td>
              {row.values.map((cell, i) => (
                <td key={i} className="px-4 py-2.5">
                  <span
                    className={cn(
                      "font-mono",
                      cell.tone === "ok" && "text-[oklch(0.80_0.14_160)]",
                      cell.tone === "warn" && "text-[oklch(0.85_0.14_90)]",
                      cell.tone === "fail" && "text-destructive",
                      cell.tone === "neutral" && "text-foreground",
                    )}
                  >
                    {cell.text}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Quick wins ────────────────────────────────────────────────────

function QuickWinsPanel({
  wins,
}: {
  wins: CompetitorSummary["quickWins"];
}) {
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
      <p className="text-label text-primary">
        → Quickest wins · {wins.length}
      </p>
      <ul className="mt-3 space-y-3">
        {wins.map((w, i) => (
          <li
            key={i}
            className="rounded-md border border-border bg-background p-3"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">
                {w.title}
              </p>
              <div className="flex gap-1.5">
                {w.targetDomain ? (
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
                    {w.targetDomain}
                  </span>
                ) : null}
                <span
                  className={cn(
                    "rounded border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider",
                    w.impact === "high"
                      ? "border-[oklch(0.72_0.14_160/30%)] text-[oklch(0.80_0.14_160)]"
                      : w.impact === "medium"
                        ? "border-[oklch(0.78_0.14_90/30%)] text-[oklch(0.85_0.14_90)]"
                        : "border-border text-muted-foreground",
                  )}
                >
                  {w.impact}
                </span>
              </div>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {w.detail}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function scoreCell(
  score: number | null,
): { text: string; tone: "ok" | "warn" | "fail" | "neutral" } {
  if (score == null) return { text: "—", tone: "neutral" };
  return {
    text: String(score),
    tone: score >= 70 ? "ok" : score >= 40 ? "warn" : "fail",
  };
}
