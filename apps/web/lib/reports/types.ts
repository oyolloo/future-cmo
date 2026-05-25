import type { AuditSectionScore } from "@/lib/audit/score";
import type { RankedBusiness } from "@/app/(app)/gm-prospecting/_components/marketing-audit-report";

/**
 * Frozen full-report payload stored in `prospect_reports.snapshot` (JSONB).
 * Mirrors the props passed to <MarketingAuditReport> so re-rendering a
 * persisted report needs zero recomputation.
 *
 * Versioned so we can evolve the shape safely — bump `v` and branch on
 * read if the schema changes.
 */
export type ReportSnapshot = {
  v: 1;
  businesses: RankedBusiness[];
  overall: number;
  sections: AuditSectionScore[];
  failures: number;
  generatedAt: string; // ISO timestamp
};
