import { cn } from "@kit/ui/lib/utils";

type RetentionData = {
  total: number;
  day7: { retained: number; eligible: number };
  day30: { retained: number; eligible: number };
  day90: { retained: number; eligible: number };
};

export function RetentionBands({ data }: { data: RetentionData }) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-label">Retention bands</p>
      <p className="text-comment mt-1">
        {"// % of stores still active after N days since first install"}
      </p>

      <div className="mt-3 flex divide-x divide-border">
        <Band label="7-day" band={data.day7} />
        <Band label="30-day" band={data.day30} />
        <Band label="90-day" band={data.day90} />
      </div>
    </div>
  );
}

function Band({
  label,
  band,
}: {
  label: string;
  band: { retained: number; eligible: number };
}) {
  const rate =
    band.eligible > 0 ? Math.round((band.retained / band.eligible) * 100) : 0;
  const tone =
    band.eligible === 0
      ? "neutral"
      : rate >= 70
        ? "ok"
        : rate >= 40
          ? "warn"
          : "fail";

  const styles: Record<typeof tone, string> = {
    ok: "border-[oklch(0.72_0.14_160/30%)] text-[oklch(0.80_0.14_160)]",
    warn: "border-[oklch(0.78_0.14_90/30%)] text-[oklch(0.85_0.14_90)]",
    fail: "border-destructive/30 text-destructive",
    neutral: "border-border text-muted-foreground",
  };

  return (
    <div className="flex-1 px-4 py-1 text-center">
      <p className="text-label">{label}</p>
      <p className={cn("mt-1 font-mono text-base font-semibold", styles[tone])}>
        {band.eligible === 0 ? "—" : `${rate}%`}
      </p>
      <p className="text-comment mt-0.5 text-[0.6rem]">
        {band.eligible === 0
          ? "no stores old enough"
          : `${band.retained} of ${band.eligible}`}
      </p>
    </div>
  );
}
