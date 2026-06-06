import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "../client";
import {
  automationJobs,
  type AutomationJobRow,
  type NewAutomationJobRow,
} from "../schema/automation-jobs";

export async function createAutomationJob(
  input: Omit<NewAutomationJobRow, "id" | "createdAt">,
): Promise<AutomationJobRow> {
  const [row] = await db.insert(automationJobs).values(input).returning();
  return row!;
}

export async function findAutomationJobById(
  userId: string,
  id: string,
): Promise<AutomationJobRow | null> {
  const rows = await db
    .select()
    .from(automationJobs)
    .where(and(eq(automationJobs.id, id), eq(automationJobs.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/** Used by the background processor — no userId scope. */
export async function findAutomationJobByIdRaw(
  id: string,
): Promise<AutomationJobRow | null> {
  const rows = await db
    .select()
    .from(automationJobs)
    .where(eq(automationJobs.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listAutomationJobsByUser(
  userId: string,
): Promise<AutomationJobRow[]> {
  return db
    .select()
    .from(automationJobs)
    .where(eq(automationJobs.userId, userId))
    .orderBy(desc(automationJobs.createdAt));
}

export async function updateAutomationJob(
  id: string,
  patch: Partial<
    Pick<
      AutomationJobRow,
      | "status"
      | "currentTaskIndex"
      | "results"
      | "taskRuns"
      | "error"
      | "startedAt"
      | "completedAt"
    >
  >,
): Promise<void> {
  await db.update(automationJobs).set(patch).where(eq(automationJobs.id, id));
}

export async function deleteAutomationJob(
  userId: string,
  id: string,
): Promise<void> {
  await db
    .delete(automationJobs)
    .where(and(eq(automationJobs.id, id), eq(automationJobs.userId, userId)));
}
