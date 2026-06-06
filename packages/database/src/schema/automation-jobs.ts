import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { users } from "./users";

/**
 * Background jobs for GM Prospecting Automation.
 *
 * One row = one queued/running/completed automation. Each job has:
 *  - A list of tasks (keyword + location pairs)
 *  - A delay between tasks (minutes/hours/days)
 *  - Accumulated results from each completed task
 *  - Current status (queued | running | completed | failed | stopped)
 *
 * The job runs in a server-side background promise so it survives
 * browser refresh. Progress is read back from this table via polling.
 */
export const automationJobs = pgTable(
  "automation_jobs",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** Auto-generated from first task — "{keyword} · {location} (+N more)" */
    name: text("name").notNull(),

    /** "queued" | "running" | "completed" | "failed" | "stopped" */
    status: text("status").notNull().default("queued"),

    /** Array of { keyword, location, maxResults }. Set once at creation. */
    tasks: jsonb("tasks").notNull(),

    delayValue: integer("delay_value").notNull().default(0),
    /** "minutes" | "hours" | "days" */
    delayUnit: text("delay_unit").notNull().default("minutes"),

    /** Index into tasks[] that is currently running or about to run. */
    currentTaskIndex: integer("current_task_index").notNull().default(0),

    /** Accumulated AutomationBusinessRow[] across all completed tasks. */
    results: jsonb("results").notNull().default([]),

    /**
     * Per-task status summary: { taskIndex, status, rowCount, startedAt,
     * finishedAt, error }. Kept separate from `tasks` so we don't rewrite
     * the input on every progress tick.
     */
    taskRuns: jsonb("task_runs").notNull().default([]),

    /**
     * Optional custom field config that filters CSV export columns.
     * When null/empty, all default columns are exported.
     * Array of { label, value } where `value` is an AutomationBusinessRow
     * key and `label` is the column header to use in the CSV.
     */
    customFields: jsonb("custom_fields"),

    error: text("error"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("automation_jobs_user_created_idx").on(table.userId, table.createdAt),
    index("automation_jobs_status_idx").on(table.status),
  ],
);

export type AutomationJobRow = typeof automationJobs.$inferSelect;
export type NewAutomationJobRow = typeof automationJobs.$inferInsert;
