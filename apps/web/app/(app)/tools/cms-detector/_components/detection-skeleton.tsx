"use client";

import { useEffect, useState } from "react";

import { Progress } from "@kit/ui/progress";

/**
 * Detection takes ~3–5 s typically — no headless Chrome involved, just
 * an HTTP fetch + happy-dom parse. We still show a progress bar so the
 * user has feedback during the wait.
 */
export function DetectionSkeleton() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = elapsedMs / 1000;
  const pct = 95 * (1 - Math.exp(-elapsedSec / 3));
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
  if (seconds < 1) return "fetching page HTML";
  if (seconds < 3) return "parsing DOM + headers";
  if (seconds < 6) return "matching fingerprints";
  if (seconds < 10) return "still working — slow origin";
  return "almost there — large page";
}
