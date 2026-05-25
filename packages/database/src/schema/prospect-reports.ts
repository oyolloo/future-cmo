import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

/**
 * Persisted Marketing Audit Reports. Each row is a frozen snapshot of one
 * "Generate Report" click — the full RankedBusiness[] + overall + sections
 * are serialized into `snapshot` so re-viewing the report later is a single
 * DB read with zero Google Places / PageSpeed calls.
 *
 * Why a separate table from `audit_reports` (which is per-prospect):
 *   `audit_reports` is meant to track a single business's audit history
 *   over time. `prospect_reports` represents the multi-business report
 *   *grouping* the user explicitly generated and wants to revisit as one
 *   entity in the Reports library.
 */
export const prospectReports = pgTable(
  "prospect_reports",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    placeIds: jsonb("place_ids").notNull().$type<string[]>(),
    businessCount: integer("business_count").notNull(),
    overallScore: integer("overall_score").notNull(),
    // Full RankedBusiness[] + overall + sections + generatedAt — see
    // ReportSnapshot type in apps/web/lib/reports/types.ts.
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("prospect_reports_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export type ProspectReport = typeof prospectReports.$inferSelect;
export type NewProspectReport = typeof prospectReports.$inferInsert;
