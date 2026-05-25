"use client";

import { useEffect, useState } from "react";

import { Progress } from "@kit/ui/progress";

export function PersonaSkeleton() {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const s = Date.now();
    const id = setInterval(() => setMs(Date.now() - s), 150);
    return () => clearInterval(id);
  }, []);
  const sec = ms / 1000;
  const pct = 95 * (1 - Math.exp(-sec / 8));
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <Progress
        value={pct}
        label={
          <span className="font-mono text-xs text-muted-foreground">
            {`// ${sec < 5 ? "building persona profiles" : sec < 15 ? "crafting pain points + messaging" : "almost there"} · ${sec.toFixed(1)}s`}
          </span>
        }
      />
    </div>
  );
}
