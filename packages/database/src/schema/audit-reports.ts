import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { prospects } from "./prospects";

/** Per-section score & signals on an audit report. */
export type AuditSection = {
  score: number; // 0–100
  signals: Record<string, unknown>;
};

/** Section keys mirror the reference's left-rail nav. */
export type AuditSectionsPayload = {
  businessDetails: AuditSection;
  technoStack: AuditSection;
  gbp: AuditSection;
  listings: AuditSection;
  onlineReputation: AuditSection;
  websitePerformance: AuditSection;
  seoAnalysis: AuditSection;
};

/**
 * Generated audit report for a saved prospect. Sections payload is JSONB
 * so the section list can evolve without a migration. overall_score is
 * extracted to a column for cheap sorting/filtering.
 */
export const auditReports = pgTable(
  "audit_reports",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    prospectId: uuid("prospect_id")
      .notNull()
      .references(() => prospects.id, { onDelete: "cascade" }),
    overallScore: integer("overall_score").notNull(),
    sections: jsonb("sections").notNull().$type<AuditSectionsPayload>(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_reports_prospect_id_idx").on(table.prospectId),
    index("audit_reports_generated_at_idx").on(table.generatedAt),
  ],
);

export type AuditReport = typeof auditReports.$inferSelect;
export type NewAuditReport = typeof auditReports.$inferInsert;
