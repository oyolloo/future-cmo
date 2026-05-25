import type { PlaceDetails, PlaceSummary } from "@/lib/maps/places";

import type { WebsiteAudit } from "./website-audit";

export type ConversionBand = "unlikely" | "moderate" | "strong";

export type ConversionScore = {
  score: number; // 0-100
  band: ConversionBand;
  signals: {
    hasWebsite: boolean;
    reviewCount: number;
    rating: number | null;
    gbpClaimed: boolean;
  };
};

/**
 * Quick "marketing presence" score for a Google Place. Lower = more gaps =
 * better opportunity for the agency to step in. Same framing as the Adam
 * Erhart reference (32% Moderate / 15% Unlikely badges).
 *
 * Weights — tuned to mirror what a local-services agency would care about:
 *   - Website presence   30 pts (binary)
 *   - Review count       40 pts (graduated: <5, <20, <50, <100, >=100)
 *   - Rating quality     20 pts (graduated: <3, <3.5, <4, <4.5, >=4.5)
 *   - GBP claimed        10 pts (currently always true — Places only returns claimed listings)
 */
export function scorePlace(place: PlaceSummary): ConversionScore {
  let score = 0;

  const hasWebsite = !!place.website;
  if (hasWebsite) score += 30;

  const reviewCount = place.reviewCount ?? 0;
  if (reviewCount >= 100) score += 40;
  else if (reviewCount >= 50) score += 30;
  else if (reviewCount >= 20) score += 20;
  else if (reviewCount >= 5) score += 10;

  const rating = place.rating ?? 0;
  if (rating >= 4.5) score += 20;
  else if (rating >= 4.0) score += 15;
  else if (rating >= 3.5) score += 10;
  else if (rating >= 3.0) score += 5;

  // If a place returned from Places Search, it's at minimum listed —
  // treat as "claimed" until we add finer signals in Phase 2.
  score += 10;

  const band: ConversionBand =
    score >= 70 ? "strong" : score >= 40 ? "moderate" : "unlikely";

  return {
    score,
    band,
    signals: {
      hasWebsite,
      reviewCount,
      rating: place.rating,
      gbpClaimed: true,
    },
  };
}

// ────────────────────────────────────────────────────────────────────
// Marketing Audit Report — per-section scoring
// ────────────────────────────────────────────────────────────────────

export type AuditSectionKey =
  | "businessDetails"
  | "technoStack"
  | "gbp"
  | "listings"
  | "onlineReputation"
  | "websitePerformance"
  | "seoAnalysis";

export type AuditSectionStatus = "implemented" | "placeholder";

export type AuditSectionScore = {
  key: AuditSectionKey;
  label: string;
  score: number; // 0-100
  status: AuditSectionStatus;
};

export type AuditBand = "weak" | "warming" | "strong";

export function auditBand(score: number): AuditBand {
  if (score >= 67) return "strong";
  if (score >= 34) return "warming";
  return "weak";
}

/**
 * Compute per-section audit scores for a single business. Pass an optional
 * `WebsiteAudit` (from `getWebsiteAudit`) to flip Techno Stack, Website
 * Performance, and SEO Analysis from placeholder to real scores.
 *
 * Listings stays a placeholder until we wire NAP scanning across Yelp /
 * Bing / Apple Maps (paid scrapers or partner APIs).
 */
export function scoreAuditSections(
  details: PlaceDetails,
  audit?: WebsiteAudit | null,
): AuditSectionScore[] {
  // Business Details — fundamental NAP + categorization fields.
  const bdSignals = [
    !!details.name && details.name !== "Unknown",
    !!details.formattedAddress,
    !!details.phone,
    details.types.length > 0,
    details.lat != null && details.lng != null,
  ];
  const businessDetails = pct(bdSignals);

  // Google Business Profile — listing completeness.
  const gbpSignals = [
    true, // listed (we wouldn't have details otherwise)
    details.photoNames.length > 0,
    details.reviews.length > 0,
    details.weekdayHours.length > 0,
    !!details.editorialSummary || (details.reviewCount ?? 0) >= 10,
  ];
  const gbp = pct(gbpSignals);

  // Online Reputation — review depth + quality.
  const orSignals = [
    (details.reviewCount ?? 0) > 0,
    (details.reviewCount ?? 0) >= 50,
    (details.rating ?? 0) >= 4.0,
  ];
  const onlineReputation = pct(orSignals);

  // Techno Stack — derived from the HTML probe + SSL check.
  let technoStack = 0;
  let technoStatus: AuditSectionStatus = "placeholder";
  if (audit) {
    const tech = audit.technoStack;
    const tsSignals = [
      // any modern build (CMS / framework / e-commerce)
      tech.some((t) =>
        [
          "WordPress",
          "Shopify",
          "Wix",
          "Squarespace",
          "Webflow",
          "Magento",
          "WooCommerce",
          "BigCommerce",
          "Next.js",
          "React",
          "Nuxt.js",
        ].includes(t),
      ),
      // analytics installed
      tech.some((t) =>
        ["Google Analytics", "Google Tag Manager", "Mixpanel"].includes(t),
      ),
      // marketing pixels
      tech.some((t) =>
        ["Meta Pixel", "LinkedIn Insight", "Hotjar"].includes(t),
      ),
      // structured markup (SEO-aware)
      tech.includes("Schema.org JSON-LD"),
      // SSL
      details.website?.startsWith("https://") ?? false,
    ];
    technoStack = pct(tsSignals);
    technoStatus = "implemented";
  }

  // Website Performance — Lighthouse mobile score from PageSpeed if we
  // got it; fall back to "has website" binary so a site that responded
  // but didn't audit doesn't read as fully broken.
  let websitePerformance = 0;
  let perfStatus: AuditSectionStatus = "implemented";
  if (audit?.pagespeedScore != null) {
    websitePerformance = audit.pagespeedScore;
  } else if (details.website) {
    // We couldn't measure — give partial credit so 100% missing-site rows
    // don't tie with 100% measured rows. 50 = "site exists, score unknown".
    websitePerformance = 50;
    perfStatus = "placeholder";
  }

  // SEO Analysis — on-page checks against the fetched HTML.
  let seo = 0;
  let seoStatus: AuditSectionStatus = "placeholder";
  if (audit?.seoSignals) {
    const sig = audit.seoSignals;
    const seoSignals = [
      sig.hasTitle,
      sig.titleLength >= 10 && sig.titleLength <= 60,
      sig.hasMetaDescription,
      sig.metaDescriptionLength >= 50 && sig.metaDescriptionLength <= 160,
      sig.hasH1,
      sig.hasOpenGraph,
      sig.hasStructuredData,
    ];
    seo = pct(seoSignals);
    seoStatus = "implemented";
  }

  return [
    {
      key: "businessDetails",
      label: "Business Details",
      score: businessDetails,
      status: "implemented",
    },
    {
      key: "technoStack",
      label: "Techno Stack",
      score: technoStack,
      status: technoStatus,
    },
    {
      key: "gbp",
      label: "Google Business Profile",
      score: gbp,
      status: "implemented",
    },
    { key: "listings", label: "Listings", score: 0, status: "placeholder" },
    {
      key: "onlineReputation",
      label: "Online Reputation",
      score: onlineReputation,
      status: "implemented",
    },
    {
      key: "websitePerformance",
      label: "Website Performance",
      score: websitePerformance,
      status: perfStatus,
    },
    {
      key: "seoAnalysis",
      label: "SEO Analysis",
      score: seo,
      status: seoStatus,
    },
  ];
}

/**
 * Average per-business section scores into a single set of aggregate
 * scores plus an Overall (mean of implemented sections only).
 */
export function aggregateAuditScores(
  perBusiness: AuditSectionScore[][],
): { overall: number; sections: AuditSectionScore[] } {
  if (perBusiness.length === 0) {
    return { overall: 0, sections: [] };
  }
  const first = perBusiness[0]!;
  const sections: AuditSectionScore[] = first.map((seed, i) => {
    const total = perBusiness.reduce((sum, row) => sum + (row[i]?.score ?? 0), 0);
    return { ...seed, score: Math.round(total / perBusiness.length) };
  });

  const implemented = sections.filter((s) => s.status === "implemented");
  const overall =
    implemented.length === 0
      ? 0
      : Math.round(
          implemented.reduce((sum, s) => sum + s.score, 0) / implemented.length,
        );

  return { overall, sections };
}

/** Per-business overall (used for ranking the table). */
export function businessOverall(sections: AuditSectionScore[]): number {
  const implemented = sections.filter((s) => s.status === "implemented");
  if (implemented.length === 0) return 0;
  return Math.round(
    implemented.reduce((sum, s) => sum + s.score, 0) / implemented.length,
  );
}

function pct(signals: boolean[]): number {
  if (signals.length === 0) return 0;
  return Math.round((signals.filter(Boolean).length / signals.length) * 100);
}
