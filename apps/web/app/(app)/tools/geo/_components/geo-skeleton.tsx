"use client";

import { useEffect, useState } from "react";

import { Progress } from "@kit/ui/progress";

export function GeoSkeleton() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 150);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = elapsedMs / 1000;
  const pct = 95 * (1 - Math.exp(-elapsedSec / 7));
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
  if (seconds < 2) return "fetching page";
  if (seconds < 5) return "extracting main content";
  if (seconds < 12) return "simulating user queries";
  if (seconds < 22) return "grading citation likelihood per query";
  if (seconds < 30) return "drafting sample AI snippet";
  return "almost there — LLM is slow today";
}
