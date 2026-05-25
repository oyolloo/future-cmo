"use client";

import { useEffect, useState } from "react";

import { Progress } from "@kit/ui/progress";

export function CompetitorSkeleton({ count }: { count: number }) {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    const s = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - s), 150);
    return () => clearInterval(id);
  }, []);

  const sec = elapsedMs / 1000;
  const pct = 95 * (1 - Math.exp(-sec / 20));

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <Progress
        value={pct}
        label={
          <span className="font-mono text-xs text-muted-foreground">
            {`// auditing ${count} sites in parallel · ${statusFor(sec)} · ${sec.toFixed(1)}s`}
          </span>
        }
      />
    </div>
  );
}

function statusFor(s: number): string {
  if (s < 5) return "fetching HTML + DNS";
  if (s < 15) return "CMS detection + mobile audit";
  if (s < 40) return "PageSpeed Insights (slow)";
  if (s < 60) return "AI SEO audit";
  if (s < 80) return "generating LLM comparison";
  return "almost there";
}
