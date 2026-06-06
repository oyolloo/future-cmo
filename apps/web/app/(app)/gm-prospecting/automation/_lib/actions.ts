"use server";

import { revalidatePath } from "next/cache";

import {
  createAutomationJob,
  deleteAutomationJob,
  findAutomationJobById,
  updateAutomationJob,
} from "@kit/database";

import { requireUser } from "@/lib/auth/session";
import {
  type AutomationTaskInput,
  type DelayUnit,
} from "@/lib/automation/processor";
import { inngest } from "@/lib/inngest/client";

import type { CustomFieldStored } from "./custom-fields-config";

// Re-export types so client components can import them from this file.
export type {
  AutomationBusinessRow,
  AutomationTaskInput,
  TaskRunSummary,
  DelayUnit,
} from "@/lib/automation/processor";

// ─── Create ──────────────────────────────────────────────────────────

export type CreateJobInput = {
  tasks: AutomationTaskInput[];
  delayValue: number;
  delayUnit: DelayUnit;
  customFields: CustomFieldStored[] | null;
};

export type CreateJobState =
  | { ok: true; jobId: string }
  | { ok: false; error: { message: string } };

export async function createAutomationJobAction(
  input: CreateJobInput,
): Promise<CreateJobState> {
  const user = await requireUser();

  const cleanTasks = input.tasks
    .map((t) => ({
      keyword: t.keyword.trim(),
      location: t.location.trim(),
      maxResults: Math.max(1, Math.min(60, t.maxResults || 60)),
    }))
    .filter((t) => t.keyword && t.location);

  if (cleanTasks.length === 0) {
    return {
      ok: false,
      error: { message: "Add at least one task with keyword + location." },
    };
  }

  const firstTask = cleanTasks[0]!;
  const name =
    cleanTasks.length > 1
      ? `${firstTask.keyword} · ${firstTask.location} (+${cleanTasks.length - 1} more)`
      : `${firstTask.keyword} · ${firstTask.location}`;

  const job = await createAutomationJob({
    userId: user.id,
    name,
    status: "queued",
    tasks: cleanTasks,
    delayValue: Math.max(0, input.delayValue),
    delayUnit: input.delayUnit,
    currentTaskIndex: 0,
    results: [],
    taskRuns: [],
    customFields: input.customFields,
  });

  // Send event to Inngest — runs durably in the background, surviving
  // serverless timeouts. Inngest persists step state and re-invokes us
  // when a sleep ends.
  await inngest.send({
    name: "automation/job.queued",
    data: { jobId: job.id, userId: user.id },
  });

  revalidatePath("/gm-prospecting/reports");
  return { ok: true, jobId: job.id };
}

// ─── Stop ────────────────────────────────────────────────────────────

export async function stopAutomationJobAction(
  jobId: string,
): Promise<{ ok: true } | { ok: false; error: { message: string } }> {
  const user = await requireUser();
  const job = await findAutomationJobById(user.id, jobId);
  if (!job) return { ok: false, error: { message: "Job not found." } };

  if (job.status === "queued" || job.status === "running") {
    // Mark stopped in DB. The Inngest function checks status before
    // each task + after each sleep and exits gracefully.
    await updateAutomationJob(jobId, {
      status: "stopped",
      completedAt: new Date(),
    });
  }

  revalidatePath(`/gm-prospecting/automation/${jobId}`);
  revalidatePath("/gm-prospecting/reports");
  return { ok: true };
}

// ─── Resume — re-queue an interrupted job ───────────────────────────

export async function resumeAutomationJobAction(
  jobId: string,
): Promise<{ ok: true } | { ok: false; error: { message: string } }> {
  const user = await requireUser();
  const job = await findAutomationJobById(user.id, jobId);
  if (!job) return { ok: false, error: { message: "Job not found." } };
  if (job.status === "completed") {
    return { ok: false, error: { message: "Job already finished." } };
  }

  // Reset status so the Inngest function picks up from currentTaskIndex
  await updateAutomationJob(jobId, { status: "queued" });
  await inngest.send({
    name: "automation/job.queued",
    data: { jobId, userId: user.id },
  });

  revalidatePath(`/gm-prospecting/automation/${jobId}`);
  return { ok: true };
}

// ─── Delete ──────────────────────────────────────────────────────────

export async function deleteAutomationJobAction(
  jobId: string,
): Promise<{ ok: true } | { ok: false; error: { message: string } }> {
  const user = await requireUser();
  // Mark stopped so the Inngest function exits next time it checks
  await updateAutomationJob(jobId, {
    status: "stopped",
    completedAt: new Date(),
  });
  await deleteAutomationJob(user.id, jobId);
  revalidatePath("/gm-prospecting/reports");
  return { ok: true };
}

// ─── Polling — read current job state ───────────────────────────────

export async function getAutomationJobAction(jobId: string) {
  const user = await requireUser();
  const job = await findAutomationJobById(user.id, jobId);
  if (!job) return { ok: false as const, error: { message: "Not found." } };
  return { ok: true as const, data: job };
}
