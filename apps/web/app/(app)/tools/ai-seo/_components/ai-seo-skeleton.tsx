"use client";

import { useEffect, useState } from "react";

import { Progress } from "@kit/ui/progress";

export function AISeoSkeleton() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 150);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = elapsedMs / 1000;
  const pct = 95 * (1 - Math.exp(-elapsedSec / 6));
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
  if (seconds < 2) return "fetching page + robots.txt + llms.txt";
  if (seconds < 6) return "parsing schema + content structure";
  if (seconds < 14) return "asking LLM for AI-citability verdict";
  if (seconds < 25) return "almost there";
  return "still working — LLM is slow today";
}
