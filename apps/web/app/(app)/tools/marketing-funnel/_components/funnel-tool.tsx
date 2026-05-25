"use client";

import { useMemo, useState } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { Label } from "@kit/ui/label";
import { cn } from "@kit/ui/lib/utils";

type Stage = { label: string; value: number };

const DEFAULT_STAGES: Stage[] = [
  { label: "Visitors", value: 0 },
  { label: "Leads", value: 0 },
  { label: "Trials", value: 0 },
  { label: "Customers", value: 0 },
];

export function FunnelTool() {
  const [stages, setStages] = useState<Stage[]>(DEFAULT_STAGES);

  const updateStage = (i: number, field: "label" | "value", v: string) => {
    setStages((prev) => {
      const next = [...prev];
      next[i] = {
        ...next[i]!,
        [field]: field === "value" ? Math.max(0, Number(v) || 0) : v,
      };
      return next;
    });
  };

  const addStage = () =>
    setStages((p) => [...p, { label: `Stage ${p.length + 1}`, value: 0 }]);

  const removeStage = (i: number) =>
    setStages((p) => p.filter((_, idx) => idx !== i));

  const hasData = stages.some((s) => s.value > 0);

  const metrics = useMemo(() => computeMetrics(stages), [stages]);

  return (
    <div className="space-y-8">
      {/* Input */}
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-label">Funnel stages</p>
        <p className="text-comment mt-1">
          {"// edit labels + enter numbers · stages flow top → bottom"}
        </p>

        <div className="mt-4 space-y-3">
          {stages.map((stage, i) => (
            <div key={i} className="flex items-end gap-3">
              <div className="w-10 shrink-0 text-center font-mono text-xs text-muted-foreground">
                {i + 1}
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-label sr-only">Label</Label>
                <Input
                  value={stage.label}
                  onChange={(e) => updateStage(i, "label", e.target.value)}
                  placeholder="Stage name"
                  className="font-medium"
                />
              </div>
              <div className="w-32 space-y-1">
                <Label className="text-label sr-only">Count</Label>
                <Input
                  type="number"
                  min={0}
                  value={stage.value || ""}
                  onChange={(e) => updateStage(i, "value", e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                />
              </div>
              {stages.length > 2 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeStage(i)}
                  title="Remove stage"
                >
                  ✕
                </Button>
              ) : null}
            </div>
          ))}
        </div>

        <div className="mt-4">
          {stages.length < 8 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addStage}
            >
              + Add stage
            </Button>
          ) : null}
        </div>
      </div>

      {/* Results */}
      {hasData ? (
        <>
          <FunnelVisualization stages={stages} metrics={metrics} />
          <MetricsTable stages={stages} metrics={metrics} />
          <Diagnosis metrics={metrics} />
        </>
      ) : null}
    </div>
  );
}

// ─── Metrics computation ────────────────────────────────────────────

type StageMetric = {
  label: string;
  value: number;
  conversionFromPrev: number | null; // % (null for first stage)
  dropOff: number | null; // absolute lost from prev
  dropOffPct: number | null; // % lost from prev
  conversionFromTop: number; // % of first stage
};

function computeMetrics(stages: Stage[]): StageMetric[] {
  const first = stages[0]?.value ?? 0;
  return stages.map((s, i) => {
    const prev = i > 0 ? stages[i - 1]!.value : null;
    return {
      label: s.label,
      value: s.value,
      conversionFromPrev:
        prev != null && prev > 0
          ? Math.round((s.value / prev) * 1000) / 10
          : null,
      dropOff: prev != null ? prev - s.value : null,
      dropOffPct:
        prev != null && prev > 0
          ? Math.round(((prev - s.value) / prev) * 1000) / 10
          : null,
      conversionFromTop:
        first > 0 ? Math.round((s.value / first) * 1000) / 10 : 0,
    };
  });
}

// ─── Funnel visualization ───────────────────────────────────────────

function FunnelVisualization({
  stages,
  metrics,
}: {
  stages: Stage[];
  metrics: StageMetric[];
}) {
  const max = Math.max(1, ...stages.map((s) => s.value));

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-label">Funnel visualization</p>
      <div className="mt-4 space-y-1">
        {metrics.map((m, i) => {
          const widthPct = max > 0 ? (m.value / max) * 100 : 0;
          const isBottleneck =
            m.dropOffPct != null && m.dropOffPct > 50;

          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate text-right text-xs text-muted-foreground">
                {m.label}
              </span>
              <div className="flex-1">
                <div
                  className={cn(
                    "flex h-8 items-center rounded-md px-3 transition-all",
                    isBottleneck
                      ? "bg-destructive/20"
                      : "bg-primary/20",
                  )}
                  style={{
                    width: `${Math.max(widthPct, 4)}%`,
                  }}
                >
                  <span className="font-mono text-xs font-medium text-foreground">
                    {m.value.toLocaleString()}
                  </span>
                </div>
              </div>
              <span className="w-16 shrink-0 text-right font-mono text-[0.6875rem] text-muted-foreground">
                {m.conversionFromPrev != null
                  ? `${m.conversionFromPrev}%`
                  : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Metrics table ──────────────────────────────────────────────────

function MetricsTable({
  stages,
  metrics,
}: {
  stages: Stage[];
  metrics: StageMetric[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="text-label px-4 py-2.5 text-left">Stage</th>
            <th className="text-label px-4 py-2.5 text-right">Count</th>
            <th className="text-label px-4 py-2.5 text-right">
              Stage conv.
            </th>
            <th className="text-label px-4 py-2.5 text-right">
              Drop-off
            </th>
            <th className="text-label px-4 py-2.5 text-right">
              From top
            </th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m, i) => (
            <tr
              key={i}
              className="border-b border-border last:border-b-0"
            >
              <td className="px-4 py-2.5 text-foreground">{m.label}</td>
              <td className="px-4 py-2.5 text-right font-mono text-foreground">
                {m.value.toLocaleString()}
              </td>
              <td className="px-4 py-2.5 text-right font-mono">
                {m.conversionFromPrev != null ? (
                  <span
                    className={
                      m.conversionFromPrev >= 50
                        ? "text-[oklch(0.80_0.14_160)]"
                        : m.conversionFromPrev >= 20
                          ? "text-[oklch(0.85_0.14_90)]"
                          : "text-destructive"
                    }
                  >
                    {m.conversionFromPrev}%
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                {m.dropOff != null
                  ? `−${m.dropOff.toLocaleString()} (${m.dropOffPct}%)`
                  : "—"}
              </td>
              <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                {m.conversionFromTop}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Diagnosis ──────────────────────────────────────────────────────

function Diagnosis({ metrics }: { metrics: StageMetric[] }) {
  const worst = metrics
    .filter((m) => m.dropOffPct != null)
    .sort((a, b) => (b.dropOffPct ?? 0) - (a.dropOffPct ?? 0));

  const bottleneck = worst[0];
  if (!bottleneck || bottleneck.dropOffPct == null) return null;

  const overall =
    metrics.length >= 2 && metrics[0]!.value > 0
      ? (
          (metrics[metrics.length - 1]!.value / metrics[0]!.value) *
          100
        ).toFixed(2)
      : "0";

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">Diagnosis</p>
      <div className="mt-3 space-y-2 text-sm">
        <p className="text-foreground">
          <span className="text-label">Overall conversion · </span>
          {overall}% (top to bottom)
        </p>
        <p className="text-foreground">
          <span className="text-label">Biggest bottleneck · </span>
          <span className="text-destructive">{bottleneck.label}</span> — losing{" "}
          {bottleneck.dropOffPct}% ({bottleneck.dropOff?.toLocaleString()}{" "}
          people) from the previous stage.
        </p>
        <p className="text-comment">
          {bottleneck.dropOffPct > 70
            ? "// critical — fix this stage before optimizing anything else"
            : bottleneck.dropOffPct > 50
              ? "// significant leak — prioritize this stage"
              : "// moderate drop-off — room for improvement"}
        </p>
      </div>
    </div>
  );
}
