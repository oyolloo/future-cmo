import "server-only";

import { and, eq, gt } from "drizzle-orm";

import { db } from "../client";
import {
  type NewWebsiteAuditRow,
  websiteAudits,
  type WebsiteAuditRow,
} from "../schema/website-audits";

export async function findFreshWebsiteAudit(
  url: string,
): Promise<WebsiteAuditRow | null> {
  const rows = await db
    .select()
    .from(websiteAudits)
    .where(
      and(
        eq(websiteAudits.url, url),
        gt(websiteAudits.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertWebsiteAudit(
  input: NewWebsiteAuditRow,
): Promise<WebsiteAuditRow> {
  const [row] = await db
    .insert(websiteAudits)
    .values(input)
    .onConflictDoUpdate({
      target: websiteAudits.url,
      set: {
        technoStack: input.technoStack,
        seoSignals: input.seoSignals,
        pagespeedScore: input.pagespeedScore,
        fetchedAt: input.fetchedAt,
        expiresAt: input.expiresAt,
      },
    })
    .returning();
  if (!row) throw new Error("upsertWebsiteAudit: no row returned");
  return row;
}
