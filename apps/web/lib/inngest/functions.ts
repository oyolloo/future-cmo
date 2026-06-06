import "server-only";

import {
  findAutomationJobByIdRaw,
  updateAutomationJob,
} from "@kit/database";

import { scorePlace } from "../audit/score";
import { searchPlaces } from "../maps/places";
import { inngest } from "./client";

type AutomationTaskInput = {
  keyword: string;
  location: string;
  maxResults: number;
};

type AutomationBusinessRow = {
  placeId: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  types: string[];
  googleMapsUri: string | null;
  conversionScore: number;
  conversionBand: "strong" | "moderate" | "unlikely";
  hasWebsite: boolean;
  taskKeyword: string;
  taskLocation: string;
};

type TaskRunSummary = {
  taskIndex: number;
  status: "queued" | "running" | "done" | "failed";
  rowCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
};

type DelayUnit = "minutes" | "hours" | "days";

/**
 * Durable execution of an automation job.
 *
 * Key Inngest concepts:
 *  - Each `step.run()` is a separate invocation — if the serverless
 *    function dies (Vercel timeout, redeploy, crash), Inngest re-invokes
 *    and skips already-completed steps.
 *  - `step.sleep()` is durable too — Inngest schedules a wake-up at the
 *    exact wall-clock time and re-invokes us then. No process needs to
 *    be running during the sleep.
 *  - We persist progress to the DB after each task so the UI can poll.
 */
export const runAutomationJob = inngest.createFunction(
  {
    id: "automation-run-job",
    name: "Run automation job",
    concurrency: { limit: 3 },
    triggers: [{ event: "automation/job.queued" }],
  },
  async ({ event, step }) => {
    const { jobId } = event.data as { jobId: string; userId: string };

    // Initial load — outside step.run so it's not memoized
    const job = await step.run("load-job", async () => {
      const j = await findAutomationJobByIdRaw(jobId);
      if (!j) throw new Error(`Job ${jobId} not found`);
      return {
        id: j.id,
        status: j.status,
        tasks: j.tasks as AutomationTaskInput[],
        delayValue: j.delayValue,
        delayUnit: j.delayUnit as DelayUnit,
        currentTaskIndex: j.currentTaskIndex,
        results: (j.results ?? []) as AutomationBusinessRow[],
        taskRuns: (j.taskRuns ?? []) as TaskRunSummary[],
      };
    });

    if (job.status === "completed" || job.status === "stopped") {
      return { jobId, skipped: true };
    }

    // Seed taskRuns once
    if (job.taskRuns.length === 0) {
      const seeded: TaskRunSummary[] = job.tasks.map((_t, i) => ({
        taskIndex: i,
        status: "queued",
        rowCount: 0,
        startedAt: null,
        finishedAt: null,
        error: null,
      }));
      await step.run("seed-runs", async () => {
        await updateAutomationJob(jobId, {
          status: "running",
          startedAt: new Date(),
          taskRuns: seeded,
        });
      });
      job.taskRuns = seeded;
    } else {
      await step.run("mark-running", async () => {
        await updateAutomationJob(jobId, { status: "running" });
      });
    }

    // Process each task. step.run() makes each one a durable checkpoint
    // — if anything fails or Vercel times out, Inngest retries just that
    // step without redoing prior tasks.
    for (let i = job.currentTaskIndex; i < job.tasks.length; i++) {
      const task = job.tasks[i]!;

      // ── Run the search task ─────────────────────────────────────
      const taskResult = await step.run(`task-${i}-search`, async () => {
        // Re-read in case user stopped between steps
        const current = await findAutomationJobByIdRaw(jobId);
        if (!current || current.status === "stopped") {
          return { stopped: true as const, rows: [] };
        }

        const runs = [...(current.taskRuns as TaskRunSummary[])];
        runs[i] = {
          taskIndex: i,
          status: "running",
          rowCount: 0,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          error: null,
        };
        await updateAutomationJob(jobId, {
          currentTaskIndex: i,
          taskRuns: runs,
        });

        try {
          const places = await searchPlaces({
            keyword: task.keyword,
            location: task.location,
            radiusKm: 10,
            maxResults: Math.min(60, Math.max(1, task.maxResults || 60)),
          });
          const rows: AutomationBusinessRow[] = places.map((p) => {
            const score = scorePlace(p);
            return {
              placeId: p.placeId,
              name: p.name,
              address: p.formattedAddress,
              phone: p.phone,
              website: p.website,
              rating: p.rating,
              reviewCount: p.reviewCount,
              types: p.types,
              googleMapsUri: p.googleMapsUri,
              conversionScore: score.score,
              conversionBand: score.band,
              hasWebsite: score.signals.hasWebsite,
              taskKeyword: task.keyword,
              taskLocation: task.location,
            };
          });

          const allResults = [
            ...((current.results ?? []) as AutomationBusinessRow[]),
            ...rows,
          ];
          runs[i] = {
            ...runs[i]!,
            status: "done",
            rowCount: rows.length,
            finishedAt: new Date().toISOString(),
          };
          await updateAutomationJob(jobId, {
            results: allResults,
            taskRuns: runs,
            currentTaskIndex: i + 1,
          });

          return { stopped: false as const, rows };
        } catch (err) {
          runs[i] = {
            ...runs[i]!,
            status: "failed",
            finishedAt: new Date().toISOString(),
            error: err instanceof Error ? err.message : "Search failed.",
          };
          await updateAutomationJob(jobId, {
            taskRuns: runs,
            currentTaskIndex: i + 1,
          });
          return { stopped: false as const, rows: [] };
        }
      });

      if (taskResult.stopped) {
        await step.run("mark-stopped", async () => {
          await updateAutomationJob(jobId, {
            status: "stopped",
            completedAt: new Date(),
          });
        });
        return { jobId, stopped: true };
      }

      // ── Sleep before next task (if any) ─────────────────────────
      const isLast = i === job.tasks.length - 1;
      if (!isLast && job.delayValue > 0) {
        const duration = `${job.delayValue}${unitToInngest(job.delayUnit)}` as const;
        await step.sleep(`delay-after-${i}`, duration);

        // After waking up, check if user requested stop
        const stoppedDuringSleep = await step.run(
          `check-stop-after-${i}`,
          async () => {
            const current = await findAutomationJobByIdRaw(jobId);
            return current?.status === "stopped";
          },
        );
        if (stoppedDuringSleep) {
          return { jobId, stopped: true };
        }
      }
    }

    await step.run("mark-completed", async () => {
      await updateAutomationJob(jobId, {
        status: "completed",
        completedAt: new Date(),
      });
    });

    return { jobId, completed: true };
  },
);

// ─── Helpers ─────────────────────────────────────────────────────────

function unitToInngest(unit: DelayUnit): "m" | "h" | "d" {
  switch (unit) {
    case "minutes":
      return "m";
    case "hours":
      return "h";
    case "days":
      return "d";
  }
}

// All registered functions, exported for the /api/inngest webhook
export const inngestFunctions = [runAutomationJob];
