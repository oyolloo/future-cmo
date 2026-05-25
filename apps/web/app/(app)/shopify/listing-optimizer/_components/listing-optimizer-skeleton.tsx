"use client";

import { useEffect, useState } from "react";

import { Progress } from "@kit/ui/progress";

export function ListingOptimizerSkeleton() {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const s = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - s), 150);
    return () => clearInterval(id);
  }, []);

  const sec = elapsedMs / 1000;
  const pct = 95 * (1 - Math.exp(-sec / 8));

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <Progress
        value={pct}
        label={
          <span className="font-mono text-xs text-muted-foreground">
            {`// ${statusFor(sec)} · ${sec.toFixed(1)}s elapsed`}
          </span>
        }
      />
    </div>
  );
}

function statusFor(s: number): string {
  if (s < 3) return "scraping App Store listing";
  if (s < 8) return "extracting title · pricing · keywords";
  if (s < 18) return "LLM optimizing listing for conversion";
  if (s < 28) return "generating copy-paste rewrites";
  return "almost there";
}
