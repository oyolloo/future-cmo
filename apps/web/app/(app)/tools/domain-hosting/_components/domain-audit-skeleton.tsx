"use client";

import { useEffect, useState } from "react";

import { Progress } from "@kit/ui/progress";

export function DomainAuditSkeleton() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 100);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = elapsedMs / 1000;
  const pct = 95 * (1 - Math.exp(-elapsedSec / 2.5));
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
  if (seconds < 0.5) return "querying RDAP + DNS";
  if (seconds < 2) return "resolving A · AAAA · MX · NS · TXT";
  if (seconds < 5) return "geo-locating server · checking email security";
  return "almost there";
}
