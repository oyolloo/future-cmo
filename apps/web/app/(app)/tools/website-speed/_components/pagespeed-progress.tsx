"use client";

import { useEffect, useState } from "react";

import { Progress } from "@kit/ui/progress";

/**
 * Time-based "fake" progress for the PageSpeed wait. We don't get real
 * progress signals from the API, so we model an asymptotic curve that
 * approaches 95 % — feels responsive early, slows toward the cap, and
 * never claims 100 % until the real result lands and replaces this UI.
 *
 * Curve: 95 · (1 − e^(−t / τ)) with τ = 40 s (timeout budget is 180 s
 * for all 4 Lighthouse categories).
 *   t=15 s → 30 %    t=30 s → 52 %
 *   t=60 s → 73 %    t=120 s → 90 %    t=180 s → 95 %
 */
export function PagespeedProgress() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 150);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = elapsedMs / 1000;
  const pct = 95 * (1 - Math.exp(-elapsedSec / 40));
  const statusLabel = statusFor(elapsedSec);

  return (
    <Progress
      value={pct}
      label={
        <span className="font-mono text-xs text-muted-foreground">
          {`// ${statusLabel} · ${elapsedSec.toFixed(1)}s elapsed`}
        </span>
      }
    />
  );
}

function statusFor(seconds: number): string {
  if (seconds < 4) return "warming up Lighthouse";
  if (seconds < 15) return "loading page in headless Chrome";
  if (seconds < 35) return "auditing performance";
  if (seconds < 70) return "auditing accessibility · best practices";
  if (seconds < 110) return "auditing SEO · scoring categories";
  if (seconds < 150) return "still working — heavy page detected";
  return "almost there — Google's analyser is slow today";
}
