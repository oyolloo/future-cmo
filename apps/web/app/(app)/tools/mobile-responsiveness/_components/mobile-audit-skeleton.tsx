"use client";

import { useEffect, useState } from "react";

import { Progress } from "@kit/ui/progress";

/**
 * 5 parallel Microlink screenshot calls + 1 HTML fetch — typical budget
 * 10–20 s. Progress models that with τ = 8 s so we hit ~75% around the
 * 10-s mark.
 */
export function MobileAuditSkeleton() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 150);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = elapsedMs / 1000;
  const pct = 95 * (1 - Math.exp(-elapsedSec / 8));
  const status = statusFor(elapsedSec);

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <Progress
        value={pct}
        label={
          <span className="font-mono text-xs text-muted-foreground">
            {`// ${status} · ${elapsedSec.toFixed(1)}s elapsed`}
          </span>
        }
      />
    </div>
  );
}

function statusFor(seconds: number): string {
  if (seconds < 2) return "fetching page HTML";
  if (seconds < 8) return "rendering iPhone · Pixel · Galaxy";
  if (seconds < 15) return "rendering iPad · Desktop";
  if (seconds < 25) return "compositing device grid";
  return "almost there — Microlink is being slow";
}
