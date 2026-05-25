import "server-only";

import {
  aggregateAuditScores,
  businessOverall,
  scoreAuditSections,
} from "@/lib/audit/score";
import {
  getWebsiteAudit,
  type WebsiteAudit,
} from "@/lib/audit/website-audit";
import { getPlaceDetails, type PlaceDetails } from "@/lib/maps/places";

import type { RankedBusiness } from "../_components/marketing-audit-report";

export async function loadAndScore(placeIds: string[]): Promise<{
  businesses: RankedBusiness[];
  overall: number;
  sections: ReturnType<typeof aggregateAuditScores>["sections"];
  failures: number;
}> {
  // Step 1: Place Details (cached 30 days). Filter to fulfilled rows.
  const settled = await Promise.allSettled(
    placeIds.map((id) => getPlaceDetails(id)),
  );
  const failures = settled.filter((r) => r.status === "rejected").length;
  const fulfilled = settled
    .filter(
      (r): r is PromiseFulfilledResult<PlaceDetails> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);

  // Step 2: Website audits (cached 24h) for rows that have a website.
  // Parallel across all businesses; missing/failed audits resolve to null.
  const websiteAudits: Array<WebsiteAudit | null> = await Promise.all(
    fulfilled.map((d) =>
      d.website
        ? getWebsiteAudit(d.website).catch((err) => {
            console.error("[loadAndScore] website audit failed", d.website, err);
            return null;
          })
        : Promise.resolve(null),
    ),
  );

  const businesses: RankedBusiness[] = fulfilled
    .map((details, i) => {
      const sections = scoreAuditSections(details, websiteAudits[i]);
      return {
        details,
        sections,
        overall: businessOverall(sections),
      };
    })
    .sort((a, b) => a.overall - b.overall); // weakest first = biggest opportunity

  const { overall, sections } = aggregateAuditScores(
    businesses.map((b) => b.sections),
  );

  return { businesses, overall, sections, failures };
}
