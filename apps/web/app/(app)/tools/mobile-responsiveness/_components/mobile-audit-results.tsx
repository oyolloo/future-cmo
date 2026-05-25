"use client";

import { useState } from "react";

import { cn } from "@kit/ui/lib/utils";

import type {
  MobileFriendlyCheck,
  MobileFriendlyReport,
} from "@/lib/audit/mobile-friendly";
import type { DeviceShot } from "@/lib/audit/microlink-screenshot";

type Props = {
  data: {
    report: MobileFriendlyReport;
    shots: DeviceShot[];
    durationMs: number;
  };
};

export function MobileAuditResults({ data }: Props) {
  const { report, shots, durationMs } = data;

  return (
    <div className="space-y-6">
      <ScoreCard report={report} />
      <SignalsBlock checks={report.checks} />
      <DeviceGrid shots={shots} />
      <p className="text-comment">
        {`// audit ran in ${(durationMs / 1000).toFixed(1)}s · screenshots by Microlink (free tier)`}
      </p>
    </div>
  );
}

// ─── Hero score ──────────────────────────────────────────────────────

function ScoreCard({ report }: { report: MobileFriendlyReport }) {
  const styles = bandStyles(report.band);

  return (
    <div className="rounded-lg border border-border bg-card px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
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
            <p className="text-label">Mobile-friendliness score</p>
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
    </div>
  );
}

// ─── Signals checklist ──────────────────────────────────────────────

function SignalsBlock({ checks }: { checks: MobileFriendlyCheck[] }) {
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

function SignalRow({ check }: { check: MobileFriendlyCheck }) {
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

function StatusIcon({ status }: { status: MobileFriendlyCheck["status"] }) {
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

// ─── Device grid ─────────────────────────────────────────────────────

function DeviceGrid({ shots }: { shots: DeviceShot[] }) {
  if (shots.length === 0) return null;

  return (
    <div>
      <p className="text-label mb-3">Device previews · {shots.length} viewports</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shots.map((shot) => (
          <DeviceCard key={shot.preset.id} shot={shot} />
        ))}
      </div>
    </div>
  );
}

function DeviceCard({ shot }: { shot: DeviceShot }) {
  const { preset, screenshotUrl, error } = shot;
  const isMobile = preset.formFactor === "mobile";
  const isTablet = preset.formFactor === "tablet";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-foreground">{preset.label}</p>
        <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          {preset.viewport.width}×{preset.viewport.height}
        </span>
      </div>
      <p className="text-comment mt-1">
        {`// ${preset.formFactor}`}
      </p>

      <div
        className={cn(
          "mt-3 overflow-hidden rounded border border-border bg-muted/20",
          isMobile
            ? "mx-auto aspect-[9/16] max-w-[200px]"
            : isTablet
              ? "aspect-[3/4]"
              : "aspect-video",
        )}
      >
        {screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={screenshotUrl}
            alt={`${preset.label} preview`}
            className="size-full object-cover object-top"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 px-4 text-center">
            <span
              className="font-mono text-[0.6875rem] uppercase tracking-wider text-destructive"
              aria-hidden
            >
              capture failed
            </span>
            <p className="text-[0.6875rem] leading-relaxed text-muted-foreground">
              {error ?? "Unknown error"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function bandStyles(band: MobileFriendlyReport["band"]) {
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

function bandLabel(band: MobileFriendlyReport["band"]): string {
  switch (band) {
    case "strong":
      return "Mobile-ready";
    case "warming":
      return "Needs work";
    case "weak":
      return "Not mobile-friendly";
  }
}
