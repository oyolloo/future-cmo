"use client";

import Link from "next/link";

import { cn } from "@kit/ui/lib/utils";

type JobRow = {
  id: string;
  name: string;
  status: "queued" | "running" | "completed" | "failed" | "stopped";
  taskCount: number;
  currentTaskIndex: number;
  resultCount: number;
  createdAt: string;
  completedAt: string | null;
};

export function AutomationJobsTable({ jobs }: { jobs: JobRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border bg-muted/30">
          <tr className="text-left text-muted-foreground">
            <th className="px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-wider">
              Name
            </th>
            <th className="px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-wider">
              Progress
            </th>
            <th className="px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-wider">
              Results
            </th>
            <th className="px-4 py-2.5 font-mono text-[0.625rem] uppercase tracking-wider">
              Created
            </th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => {
            const pct =
              j.taskCount > 0
                ? Math.round((j.currentTaskIndex / j.taskCount) * 100)
                : 0;
            return (
              <tr
                key={j.id}
                className="border-b border-border/60 last:border-0 hover:bg-muted/30"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/gm-prospecting/automation/${j.id}`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {j.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={j.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted/60">
                      <div
                        className={cn(
                          "h-full transition-[width] duration-300",
                          j.status === "failed"
                            ? "bg-destructive"
                            : j.status === "stopped"
                              ? "bg-[oklch(0.85_0.14_90)]"
                              : "bg-primary",
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[0.6875rem] text-muted-foreground">
                      {j.currentTaskIndex}/{j.taskCount}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-foreground">
                  {j.resultCount}
                </td>
                <td className="px-4 py-3 font-mono text-[0.6875rem] text-muted-foreground">
                  {formatRelative(j.createdAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: JobRow["status"] }) {
  const styles = {
    queued: "border-border bg-muted/40 text-muted-foreground",
    running: "border-primary/30 bg-primary/10 text-primary",
    completed:
      "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
    failed: "border-destructive/30 bg-destructive/10 text-destructive",
    stopped:
      "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/10%)] text-[oklch(0.85_0.14_90)]",
  }[status];
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider",
        styles,
      )}
    >
      {status}
    </span>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
