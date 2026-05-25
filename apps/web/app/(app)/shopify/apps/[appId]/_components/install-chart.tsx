"use client";

import { cn } from "@kit/ui/lib/utils";

type DailyPoint = {
  day: string; // YYYY-MM-DD
  installs: number;
  uninstalls: number;
};

type Props = {
  data: DailyPoint[];
  /** Inclusive start (UTC) — used to render an empty axis when data is sparse. */
  startDay: string;
  /** Inclusive end (UTC). */
  endDay: string;
};

/**
 * Pure-CSS daily install/uninstall stacked bar chart. We avoid pulling
 * in a chart library since this is the only chart in the app right now
 * and the layout is trivial:
 *
 *   - X axis = days from startDay → endDay
 *   - Bar height = count, normalised to the max count in the window
 *   - Installs render as green stack, uninstalls as red stack below
 *
 * Hover any bar to see the numbers.
 */
export function InstallChart({ data, startDay, endDay }: Props) {
  const series = expandDays(startDay, endDay, data);
  const peak = Math.max(
    1,
    ...series.map((p) => Math.max(p.installs, p.uninstalls)),
  );

  const totalInstalls = series.reduce((sum, p) => sum + p.installs, 0);
  const totalUninstalls = series.reduce(
    (sum, p) => sum + p.uninstalls,
    0,
  );
  const net = totalInstalls - totalUninstalls;

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-label">
          Installs vs uninstalls · {series.length} days
        </p>
        <div className="flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-wider">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-[oklch(0.72_0.14_160)]" />
            {totalInstalls} installs
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-destructive" />
            {totalUninstalls} uninstalls
          </span>
          <span
            className={cn(
              "rounded border px-1.5 py-0.5",
              net > 0
                ? "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]"
                : net < 0
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-border bg-muted/40 text-muted-foreground",
            )}
          >
            net {net > 0 ? "+" : ""}
            {net}
          </span>
        </div>
      </div>

      <div className="mt-4 flex h-44 items-end gap-px overflow-x-auto rounded-md border border-border bg-background p-3">
        {series.map((p) => {
          const installH = (p.installs / peak) * 100;
          const uninstallH = (p.uninstalls / peak) * 100;
          const totalH = installH + uninstallH;
          return (
            <div
              key={p.day}
              className="group relative flex h-full min-w-[6px] flex-1 flex-col justify-end"
              title={`${p.day} · +${p.installs} installs · -${p.uninstalls} uninstalls`}
            >
              {totalH > 0 ? (
                <>
                  {uninstallH > 0 ? (
                    <div
                      className="bg-destructive/80 group-hover:bg-destructive"
                      style={{ height: `${uninstallH}%` }}
                    />
                  ) : null}
                  {installH > 0 ? (
                    <div
                      className="bg-[oklch(0.72_0.14_160/70%)] group-hover:bg-[oklch(0.72_0.14_160)]"
                      style={{ height: `${installH}%` }}
                    />
                  ) : null}
                </>
              ) : (
                <div className="h-[1px] bg-border" />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between font-mono text-[0.625rem] text-muted-foreground">
        <span>{series[0]?.day}</span>
        <span>{series[series.length - 1]?.day}</span>
      </div>
    </div>
  );
}

/** Fill in any missing days between start + end with zero counts. */
function expandDays(
  startDay: string,
  endDay: string,
  data: DailyPoint[],
): DailyPoint[] {
  const map = new Map<string, DailyPoint>();
  for (const p of data) map.set(p.day, p);

  const start = new Date(`${startDay}T00:00:00Z`);
  const end = new Date(`${endDay}T00:00:00Z`);
  const out: DailyPoint[] = [];
  for (
    let d = new Date(start);
    d.getTime() <= end.getTime();
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    const day = d.toISOString().slice(0, 10);
    out.push(
      map.get(day) ?? { day, installs: 0, uninstalls: 0 },
    );
  }
  return out;
}
