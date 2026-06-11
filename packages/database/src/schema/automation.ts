import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── BizLeads Settings (per-workspace SMTP config) ────────────────────────────

export const bizleadsSettings = pgTable("bizleads_settings", {
  workspaceId: integer("workspace_id").primaryKey(),
  data: jsonb("data")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── BizLeads Jobs (campaign job queue) ───────────────────────────────────────

export const bizleadsJobs = pgTable(
  "bizleads_jobs",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    channel: text("channel").notNull(), // 'whatsapp' | 'email'
    status: text("status").notNull().default("pending"), // 'pending' | 'running' | 'done' | 'failed'
    runAt: timestamp("run_at", { withTimezone: true }).notNull(),
    nextRunAt: timestamp("next_run_at", { withTimezone: true }),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    recurrence: text("recurrence"), // null | 'once' | 'daily' | 'weekly'
    payload: jsonb("payload")
      .$type<{
        recipients: Array<{ to: string; message: string; subject?: string }>;
        delaySec?: number;
      }>()
      .notNull()
      .default({ recipients: [] }),
    attempts: integer("attempts").notNull().default(0),
    result: jsonb("result").$type<{ sent: number; failed: number }>(),
    createdBy: integer("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_bizleads_jobs_ws").on(t.workspaceId),
    index("idx_bizleads_jobs_due").on(t.status, t.nextRunAt),
  ],
);

// ── BizLeads Job Log (per-recipient send result) ─────────────────────────────

export const bizleadsJobLog = pgTable("bizleads_job_log", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  jobId: bigint("job_id", { mode: "bigint" }).notNull(),
  status: text("status").notNull(), // 'sent' | 'failed' | 'insufficient_credits'
  message: text("message"),
  data: jsonb("data").$type<{ to: string; messageId?: string }>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── BizLeads Credits (per-workspace balance) ─────────────────────────────────

export const bizleadsCredits = pgTable("bizleads_credits", {
  workspaceId: integer("workspace_id").primaryKey(),
  balance: integer("balance").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── BizLeads Credit Transactions (ledger) ────────────────────────────────────

export const bizleadsCreditTx = pgTable(
  "bizleads_credit_tx",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    delta: integer("delta").notNull(), // +/- credit change
    reason: text("reason").notNull(), // 'whatsapp' | 'email' | 'scrape'
    referenceId: text("reference_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_bizleads_credit_tx_ws").on(t.workspaceId),
    index("idx_bizleads_credit_tx_ref").on(t.referenceId),
  ],
);

// ── Incomplete Checkouts (abandoned cart tracking) ───────────────────────────

export const incompleteCheckouts = pgTable("incomplete_checkouts", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  phone: text("phone"),
  email: text("email"),
  followUpAt: timestamp("follow_up_at", { withTimezone: true }),
  followUpStatus: text("follow_up_status").notNull().default("none"), // 'none' | 'processing' | 'sms' | 'email' | 'skipped' | 'failed'
  followUpNote: text("follow_up_note"),
  status: text("status").notNull().default("abandoned"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Courier Consignments (shipment tracking) ─────────────────────────────────

export const courierConsignments = pgTable("courier_consignments", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'in-transit' | 'delivered' | 'returned' | 'cancelled'
  needsRefresh: boolean("needs_refresh").notNull().default(false),
  lastTrackedAt: timestamp("last_tracked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Report Configs (scheduled report definitions) ────────────────────────────

export const reportConfigs = pgTable("report_configs", {
  id: bigserial("id", { mode: "bigint" }).primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  name: text("name").notNull(),
  frequency: text("frequency").notNull().default("weekly"), // 'weekly' | 'monthly'
  recipients: jsonb("recipients").$type<string[]>().notNull().default([]),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
