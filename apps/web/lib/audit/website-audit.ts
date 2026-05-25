import "server-only";

import {
  findFreshWebsiteAudit,
  upsertWebsiteAudit,
  type SeoSignals,
  type WebsiteAuditRow,
} from "@kit/database";

import { getPagespeedScore } from "./pagespeed";
import { analyzeSEO, detectTechnoStack, fetchHtml } from "./website";

export type WebsiteAudit = {
  url: string;
  technoStack: string[];
  seoSignals: SeoSignals | null;
  pagespeedScore: number | null;
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function fromRow(row: WebsiteAuditRow): WebsiteAudit {
  return {
    url: row.url,
    technoStack: row.technoStack,
    seoSignals: row.seoSignals,
    pagespeedScore: row.pagespeedScore,
  };
}

/**
 * Fetch + cache a website audit. Runs the HTML probe (techno stack + SEO)
 * and PageSpeed lookup in parallel — both fail soft so a slow PageSpeed
 * call doesn't block the report.
 *
 * Cache: 24-hour TTL (sites change more often than place details, but not
 * so fast that we should re-fetch on every report open).
 */
export async function getWebsiteAudit(url: string): Promise<WebsiteAudit> {
  const cached = await findFreshWebsiteAudit(url);
  if (cached) return fromRow(cached);

  const [htmlResult, pagespeedResult] = await Promise.allSettled([
    fetchHtml(url),
    getPagespeedScore(url),
  ]);

  const html =
    htmlResult.status === "fulfilled" ? htmlResult.value : null;
  const pagespeedScore =
    pagespeedResult.status === "fulfilled" ? pagespeedResult.value : null;

  const technoStack = html ? detectTechnoStack(html) : [];
  const seoSignals = html ? analyzeSEO(html) : null;

  const audit: WebsiteAudit = {
    url,
    technoStack,
    seoSignals,
    pagespeedScore,
  };

  // Persist — errors here shouldn't break the audit; caller already has data.
  try {
    await upsertWebsiteAudit({
      url,
      technoStack,
      seoSignals,
      pagespeedScore,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    });
  } catch (err) {
    console.error("[getWebsiteAudit] cache write failed", err);
  }

  return audit;
}
