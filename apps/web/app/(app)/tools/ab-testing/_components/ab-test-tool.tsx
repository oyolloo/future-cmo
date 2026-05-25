"use client";

import { useMemo, useState } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { Label } from "@kit/ui/label";
import { cn } from "@kit/ui/lib/utils";

type Tab = "significance" | "planner";

export function ABTestTool() {
  const [tab, setTab] = useState<Tab>("significance");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 border-b border-border">
        <TabButton
          active={tab === "significance"}
          onClick={() => setTab("significance")}
          label="Is my result significant?"
        />
        <TabButton
          active={tab === "planner"}
          onClick={() => setTab("planner")}
          label="Plan a test"
        />
      </div>
      {tab === "significance" ? <SignificanceCalc /> : <SampleSizePlanner />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-4 py-2 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors",
        active
          ? "border-primary text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

// ─── Significance calculator ────────────────────────────────────────

function SignificanceCalc() {
  const [visitorsA, setVisitorsA] = useState("");
  const [conversionsA, setConversionsA] = useState("");
  const [visitorsB, setVisitorsB] = useState("");
  const [conversionsB, setConversionsB] = useState("");

  const result = useMemo(() => {
    const vA = Number(visitorsA);
    const cA = Number(conversionsA);
    const vB = Number(visitorsB);
    const cB = Number(conversionsB);
    if (vA < 1 || vB < 1 || cA < 0 || cB < 0) return null;
    if (cA > vA || cB > vB) return null;
    return computeSignificance(vA, cA, vB, cB);
  }, [visitorsA, conversionsA, visitorsB, conversionsB]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <VariantInput
          label="Control (A)"
          visitors={visitorsA}
          conversions={conversionsA}
          onVisitors={setVisitorsA}
          onConversions={setConversionsA}
        />
        <VariantInput
          label="Variation (B)"
          visitors={visitorsB}
          conversions={conversionsB}
          onVisitors={setVisitorsB}
          onConversions={setConversionsB}
        />
      </div>

      {result ? <SignificanceResults result={result} /> : null}
    </div>
  );
}

function VariantInput({
  label,
  visitors,
  conversions,
  onVisitors,
  onConversions,
}: {
  label: string;
  visitors: string;
  conversions: string;
  onVisitors: (v: string) => void;
  onConversions: (v: string) => void;
}) {
  const rate =
    Number(visitors) > 0
      ? ((Number(conversions) / Number(visitors)) * 100).toFixed(2)
      : "—";

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">{label}</p>
      <div className="mt-3 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Visitors</Label>
          <Input
            type="number"
            min={0}
            value={visitors}
            onChange={(e) => onVisitors(e.target.value)}
            placeholder="e.g. 5000"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Conversions</Label>
          <Input
            type="number"
            min={0}
            value={conversions}
            onChange={(e) => onConversions(e.target.value)}
            placeholder="e.g. 150"
            inputMode="numeric"
          />
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          Rate: {rate}%
        </p>
      </div>
    </div>
  );
}

type SignResult = {
  rateA: number;
  rateB: number;
  lift: number;
  zScore: number;
  pValue: number;
  significant: boolean;
  confidence: number;
  winner: "A" | "B" | "none";
};

function computeSignificance(
  vA: number,
  cA: number,
  vB: number,
  cB: number,
): SignResult {
  const rateA = cA / vA;
  const rateB = cB / vB;
  const lift = rateA > 0 ? ((rateB - rateA) / rateA) * 100 : 0;

  // Pooled proportion for two-proportion z-test.
  const pooled = (cA + cB) / (vA + vB);
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / vA + 1 / vB));
  const zScore = se > 0 ? (rateB - rateA) / se : 0;

  // Two-tailed p-value from normal CDF approximation.
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));
  const significant = pValue < 0.05;
  const confidence = (1 - pValue) * 100;

  const winner = !significant
    ? "none"
    : rateB > rateA
      ? "B"
      : "A";

  return {
    rateA: rateA * 100,
    rateB: rateB * 100,
    lift,
    zScore,
    pValue,
    significant,
    confidence,
    winner,
  };
}

function SignificanceResults({ result }: { result: SignResult }) {
  return (
    <div className="space-y-4">
      {/* Verdict */}
      <div
        className={cn(
          "rounded-lg border p-5",
          result.significant
            ? "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/5%)]"
            : "border-border bg-card",
        )}
      >
        <p
          className={cn(
            "text-lg font-semibold",
            result.significant
              ? "text-[oklch(0.80_0.14_160)]"
              : "text-muted-foreground",
          )}
        >
          {result.significant
            ? `${result.winner === "B" ? "Variation B wins" : "Control A wins"} — statistically significant`
            : "Not significant — keep running the test"}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {result.significant
            ? `${result.confidence.toFixed(1)}% confidence that the difference is real (p = ${result.pValue.toFixed(4)}).`
            : `Only ${result.confidence.toFixed(1)}% confidence (p = ${result.pValue.toFixed(4)}). Need p < 0.05 (95% confidence) to declare a winner.`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Rate A" value={`${result.rateA.toFixed(2)}%`} />
        <Stat label="Rate B" value={`${result.rateB.toFixed(2)}%`} />
        <Stat
          label="Lift"
          value={`${result.lift > 0 ? "+" : ""}${result.lift.toFixed(2)}%`}
        />
        <Stat label="p-value" value={result.pValue.toFixed(4)} />
      </div>
    </div>
  );
}

// ─── Sample size planner ────────────────────────────────────────────

function SampleSizePlanner() {
  const [baselineRate, setBaselineRate] = useState("5");
  const [mde, setMde] = useState("20");
  const [dailyTraffic, setDailyTraffic] = useState("1000");

  const result = useMemo(() => {
    const baseline = Number(baselineRate) / 100;
    const mdeRel = Number(mde) / 100;
    const traffic = Number(dailyTraffic);
    if (baseline <= 0 || baseline >= 1 || mdeRel <= 0 || traffic < 1)
      return null;
    return computeSampleSize(baseline, mdeRel, traffic);
  }, [baselineRate, mde, dailyTraffic]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Baseline conversion rate (%)</Label>
            <Input
              type="number"
              min={0.1}
              max={99}
              step={0.1}
              value={baselineRate}
              onChange={(e) => setBaselineRate(e.target.value)}
              placeholder="5"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Min detectable effect (% relative)
            </Label>
            <Input
              type="number"
              min={1}
              max={100}
              value={mde}
              onChange={(e) => setMde(e.target.value)}
              placeholder="20"
            />
            <p className="text-comment">
              {"// e.g. 20% means detecting a lift from 5% → 6%"}
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Daily traffic (both variants)</Label>
            <Input
              type="number"
              min={1}
              value={dailyTraffic}
              onChange={(e) => setDailyTraffic(e.target.value)}
              placeholder="1000"
            />
          </div>
        </div>
      </div>

      {result ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat
            label="Sample per variant"
            value={result.samplePerVariant.toLocaleString()}
          />
          <Stat
            label="Total sample"
            value={result.totalSample.toLocaleString()}
          />
          <Stat
            label="Duration"
            value={`${result.daysNeeded} days`}
          />
        </div>
      ) : null}
    </div>
  );
}

function computeSampleSize(
  baseline: number,
  mdeRelative: number,
  dailyTraffic: number,
): {
  samplePerVariant: number;
  totalSample: number;
  daysNeeded: number;
} {
  // Standard formula: n = (Z_α/2 + Z_β)² × [p1(1-p1) + p2(1-p2)] / (p2-p1)²
  // α = 0.05 (95% confidence), β = 0.20 (80% power)
  const zAlpha = 1.96;
  const zBeta = 0.84;
  const p1 = baseline;
  const p2 = baseline * (1 + mdeRelative);
  const diff = p2 - p1;
  if (diff <= 0) return { samplePerVariant: 0, totalSample: 0, daysNeeded: 0 };

  const n = Math.ceil(
    ((zAlpha + zBeta) ** 2 * (p1 * (1 - p1) + p2 * (1 - p2))) /
      diff ** 2,
  );

  const totalSample = n * 2;
  const perDay = dailyTraffic; // split 50/50
  const daysNeeded = Math.ceil(totalSample / perDay);

  return { samplePerVariant: n, totalSample, daysNeeded };
}

// ─── Shared ─────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-label">{label}</p>
      <p className="mt-1.5 font-mono text-base font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

/**
 * Normal CDF approximation (Abramowitz & Stegun 26.2.17).
 * Accurate to ~1.5×10⁻⁷.
 */
function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * absX);
  const y =
    1 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
      t *
      Math.exp(-absX * absX);
  return 0.5 * (1 + sign * y);
}
