"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@kit/ui/button";
import { cn } from "@kit/ui/lib/utils";

import {
  deleteAutomationJobAction,
  getAutomationJobAction,
  resumeAutomationJobAction,
  stopAutomationJobAction,
  type AutomationBusinessRow,
  type AutomationTaskInput,
  type TaskRunSummary,
} from "../../_lib/actions";
import type { CustomFieldStored } from "../../_lib/custom-fields-config";
import { downloadCsv, rowsToCsv } from "../../_lib/export-csv";

type JobRow = {
  id: string;
  userId: string;
  name: string;
  status: "queued" | "running" | "completed" | "failed" | "stopped";
  tasks: AutomationTaskInput[];
  delayValue: number;
  delayUnit: "minutes" | "hours" | "days";
  currentTaskIndex: number;
  results: AutomationBusinessRow[];
  taskRuns: TaskRunSummary[];
  customFields: CustomFieldStored[] | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export function JobDetailView({ initialJob }: { initialJob: JobRow }) {
  const router = useRouter();
  const [job, setJob] = useState<JobRow>(initialJob);
  const [isPending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isActive = job.status === "queued" || job.status === "running";

  // Poll every 2s while active. Stop polling when finished.
  useEffect(() => {
    if (!isActive) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const tick = async () => {
      const res = await getAutomationJobAction(job.id);
      if (res.ok) setJob(JSON.parse(JSON.stringify(res.data)));
    };
    pollRef.current = setInterval(tick, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [isActive, job.id]);

  const onStop = () => {
    startTransition(async () => {
      await stopAutomationJobAction(job.id);
      const res = await getAutomationJobAction(job.id);
      if (res.ok) setJob(JSON.parse(JSON.stringify(res.data)));
    });
  };

  const onResume = () => {
    startTransition(async () => {
      await resumeAutomationJobAction(job.id);
      const res = await getAutomationJobAction(job.id);
      if (res.ok) setJob(JSON.parse(JSON.stringify(res.data)));
    });
  };

  const onDelete = () => {
    if (!confirm("Delete this automation job and all its results?")) return;
    startTransition(async () => {
      await deleteAutomationJobAction(job.id);
      router.push("/gm-prospecting/reports");
    });
  };

  const onDownload = () => {
    if (job.results.length === 0) return;
    const stamp = new Date(job.createdAt).toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCsv(
      `automation-${stamp}`,
      rowsToCsv(job.results, job.customFields),
    );
  };

  const total = job.tasks.length;
  const doneCount = job.taskRuns.filter(
    (r) => r.status === "done" || r.status === "failed",
  ).length;
  const progressPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <div className="mt-6 space-y-6">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-label">— automation · {job.id.slice(0, 8)}</p>
          <h1 className="mt-3 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
            {job.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <StatusPill status={job.status} />
            <span className="font-mono text-[0.6875rem] text-muted-foreground">
              created {new Date(job.createdAt).toLocaleString()}
            </span>
            {job.completedAt ? (
              <span className="font-mono text-[0.6875rem] text-muted-foreground">
                · finished {new Date(job.completedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isActive ? (
            <Button variant="outline" onClick={onStop} disabled={isPending}>
              ◼ Stop
            </Button>
          ) : null}
          {(job.status === "stopped" || job.status === "failed") &&
          job.currentTaskIndex < total ? (
            <Button variant="outline" onClick={onResume} disabled={isPending}>
              ▶ Resume
            </Button>
          ) : null}
          <Button
            onClick={onDownload}
            disabled={job.results.length === 0}
          >
            ⬇ CSV ({job.results.length} rows)
          </Button>
          <Button
            variant="ghost"
            onClick={onDelete}
            disabled={isPending}
            className="text-destructive"
          >
            Delete
          </Button>
        </div>
      </header>

      {/* Progress */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-label">
            Progress · {doneCount} / {total}
          </p>
          <span className="font-mono text-[0.6875rem] text-muted-foreground">
            {progressPct}%
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
          <div
            className={cn(
              "h-full transition-[width] duration-300",
              job.status === "failed"
                ? "bg-destructive"
                : "bg-primary",
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Delay info */}
        {job.delayValue > 0 ? (
          <p className="text-comment mt-3">
            {`// ${job.delayValue} ${job.delayUnit} delay between tasks`}
          </p>
        ) : (
          <p className="text-comment mt-3">{"// loop mode — no delay between tasks"}</p>
        )}

        {job.error ? (
          <p className="mt-3 text-xs text-destructive">{job.error}</p>
        ) : null}

        {/* Per-task list */}
        <ul className="mt-4 divide-y divide-border">
          {job.tasks.map((t, i) => {
            const run = job.taskRuns.find((r) => r.taskIndex === i);
            return (
              <li key={i} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded border border-border bg-muted/40 font-mono text-[0.625rem] text-muted-foreground">
                    {i + 1}
                  </span>
                  <StatusPill status={run?.status ?? "queued"} small />
                  <span className="text-sm text-foreground">{t.keyword}</span>
                  <span className="font-mono text-[0.6875rem] text-muted-foreground">
                    in {t.location}
                  </span>
                  <span className="ml-auto font-mono text-[0.6875rem] text-muted-foreground">
                    {run?.status === "done"
                      ? `${run.rowCount} results`
                      : run?.status === "running"
                        ? "running…"
                        : run?.status === "failed"
                          ? "failed"
                          : "queued"}
                  </span>
                </div>
                {run?.error ? (
                  <p className="ml-8 mt-1 text-[0.6875rem] text-destructive">
                    {run.error}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Results preview */}
      {job.results.length > 0 ? (
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-label">Results · {job.results.length} businesses</p>
            <p className="text-comment">
              {"// download CSV for the complete list"}
            </p>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2 font-mono uppercase tracking-wider text-[0.625rem]">Business</th>
                  <th className="px-2 py-2 font-mono uppercase tracking-wider text-[0.625rem]">Location</th>
                  <th className="px-2 py-2 font-mono uppercase tracking-wider text-[0.625rem]">Website</th>
                  <th className="px-2 py-2 font-mono uppercase tracking-wider text-[0.625rem]">Rating</th>
                  <th className="px-2 py-2 font-mono uppercase tracking-wider text-[0.625rem]">Score</th>
                </tr>
              </thead>
              <tbody>
                {job.results.slice(0, 50).map((r, i) => (
                  <tr
                    key={`${r.placeId}-${i}`}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="max-w-[200px] truncate px-2 py-2 text-foreground">
                      {r.name}
                    </td>
                    <td className="max-w-[200px] truncate px-2 py-2 text-muted-foreground">
                      {r.taskLocation}
                    </td>
                    <td className="max-w-[200px] truncate px-2 py-2">
                      {r.website ? (
                        <a
                          href={r.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-[0.6875rem] text-primary hover:underline"
                        >
                          {r.website.replace(/^https?:\/\//, "")}
                        </a>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 font-mono text-muted-foreground">
                      {r.rating != null ? `${r.rating} (${r.reviewCount ?? 0})` : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-2 font-mono font-semibold",
                        r.conversionScore >= 70
                          ? "text-[oklch(0.80_0.14_160)]"
                          : r.conversionScore >= 40
                            ? "text-[oklch(0.85_0.14_90)]"
                            : "text-destructive",
                      )}
                    >
                      {r.conversionScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {job.results.length > 50 ? (
              <p className="text-comment mt-3">
                {`// showing first 50 of ${job.results.length} — download CSV for all`}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({
  status,
  small,
}: {
  status: TaskRunSummary["status"] | "completed" | "stopped";
  small?: boolean;
}) {
  const styles = {
    queued: "border-border bg-muted/40 text-muted-foreground",
    running: "border-primary/30 bg-primary/10 text-primary",
    done: "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
    completed:
      "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
    failed: "border-destructive/30 bg-destructive/10 text-destructive",
    stopped: "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/10%)] text-[oklch(0.85_0.14_90)]",
  }[status] ?? "border-border bg-muted/40 text-muted-foreground";

  return (
    <span
      className={cn(
        "rounded border font-mono uppercase tracking-wider",
        small ? "px-1.5 py-0.5 text-[0.5625rem]" : "px-2 py-0.5 text-[0.625rem]",
        styles,
      )}
    >
      {status}
    </span>
  );
}
