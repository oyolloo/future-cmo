import "server-only";

import { env } from "@kit/shared/env";

const ENDPOINT =
  "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";

export type PagespeedStrategy = "mobile" | "desktop";

// ─── Public types ─────────────────────────────────────────────────────

export type PagespeedMetric = {
  id: string;
  title: string;
  value: number;
  displayValue: string;
  score: number; // 0–1
};

/** Per-row item Lighthouse attaches to an audit's `details.items`. */
export type AuditItem = Record<string, unknown>;

export type AuditHeading = {
  key: string;
  label: string;
  /** url, link, bytes, ms, timespanMs, numeric, text, code, source-location, node, thumbnail. */
  valueType: string;
  granularity?: number;
  /** Sub-items rendering hint (Lighthouse may nest children under a parent row). */
  subItemsHeading?: { key: string; valueType?: string };
};

export type PagespeedAudit = {
  id: string;
  title: string;
  description: string;
  /** 0–1, or null for non-binary audits (manual / informative / N/A). */
  score: number | null;
  /** "numeric" | "binary" | "informative" | "manual" | "notApplicable" | "error". */
  scoreDisplayMode: string;
  displayValue: string | null;
  numericValue: number | null;
  /** Lighthouse opportunity-style savings. */
  savingsMs: number;
  savingsBytes: number;
  headings: AuditHeading[];
  items: AuditItem[];
  /** Weight from the audit ref in the category — 0 means no impact on score. */
  weight: number;
};

export type PagespeedCategoryGroup = {
  id: string;
  title: string;
  description: string | null;
  audits: PagespeedAudit[];
};

export type PagespeedCategoryId =
  | "performance"
  | "accessibility"
  | "best-practices"
  | "seo";

export type PagespeedCategory = {
  id: PagespeedCategoryId;
  title: string;
  /** 0–100, or null when Lighthouse skipped this category. */
  score: number | null;
  description: string | null;
  /**
   * Audits actively flagged, organised by their group (e.g. "Insights",
   * "Diagnostics", "Navigation"). Empty groups dropped.
   */
  groups: PagespeedCategoryGroup[];
  /** Audits Lighthouse fully passed (score === 1). */
  passed: PagespeedAudit[];
  /** Audits requiring manual verification (scoreDisplayMode === "manual"). */
  manual: PagespeedAudit[];
  /** Audits not applicable to this page (scoreDisplayMode === "notApplicable"). */
  notApplicable: PagespeedAudit[];
};

export type PagespeedLoadingExperience = {
  category: "FAST" | "AVERAGE" | "SLOW" | null;
  metrics: Array<{
    id: string;
    label: string;
    percentile: number | null;
    category: "FAST" | "AVERAGE" | "SLOW" | null;
  }>;
};

export type PagespeedDetails = {
  url: string;
  finalUrl: string;
  strategy: PagespeedStrategy;
  fetchedAt: string;
  lighthouseVersion: string;

  // Core Web Vitals + key lab metrics from the Performance category.
  metrics: PagespeedMetric[];

  // All 4 Lighthouse categories with hierarchy mirroring the panel UI.
  categories: PagespeedCategory[];

  // Final viewport screenshot (data URI).
  screenshot: string | null;

  // CrUX real-user field data (when origin has enough traffic).
  fieldData: PagespeedLoadingExperience | null;

  // Lighthouse self-reported issues during the run.
  runWarnings: string[];
  runtimeError: { code: string; message: string } | null;
};

export type PagespeedError =
  | { kind: "no_api_key" }
  | { kind: "timeout" }
  | { kind: "http_error"; status: number; message: string }
  | { kind: "invalid_response"; message: string }
  | { kind: "network"; message: string };

// ─── Fetch + retry ────────────────────────────────────────────────────

type PagespeedResult =
  | { ok: true; data: PagespeedDetails }
  | { ok: false; error: PagespeedError };

const CATEGORIES_ORDERED: PagespeedCategoryId[] = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
];

const METRIC_IDS_ORDERED = [
  "first-contentful-paint",
  "largest-contentful-paint",
  "speed-index",
  "total-blocking-time",
  "cumulative-layout-shift",
  "interactive",
] as const;

/**
 * Full PageSpeed Insights v5 fetch — all 4 Lighthouse categories with the
 * complete group/audit hierarchy mirroring the Lighthouse panel UI.
 *
 * Slow: 30–90 s typical for all 4 categories. We give it 180 s and retry
 * once on 5xx/network errors (Lighthouse transients).
 */
export async function getPagespeedDetails(
  url: string,
  strategy: PagespeedStrategy = "mobile",
): Promise<PagespeedResult> {
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key || key.length < 30) {
    return { ok: false, error: { kind: "no_api_key" } };
  }

  const first = await runPagespeedOnce(url, strategy, key);
  if (first.ok) return first;

  const retriable =
    first.error.kind === "network" ||
    (first.error.kind === "http_error" && first.error.status >= 500);
  if (!retriable) return first;

  await new Promise((r) => setTimeout(r, 2000));
  return runPagespeedOnce(url, strategy, key);
}

async function runPagespeedOnce(
  url: string,
  strategy: PagespeedStrategy,
  key: string,
): Promise<PagespeedResult> {
  const controller = new AbortController();
  // All 4 categories on JS-heavy pages can take 90–150 s on Google's
  // servers. 180 s budget leaves headroom without making the user wait
  // pathologically long.
  const timer = setTimeout(() => controller.abort(), 180_000);

  try {
    const target = new URL(ENDPOINT);
    target.searchParams.set("url", url);
    target.searchParams.set("strategy", strategy);
    for (const cat of CATEGORIES_ORDERED) {
      target.searchParams.append("category", cat);
    }
    target.searchParams.set("key", key);

    const res = await fetch(target, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: {
          kind: "http_error",
          status: res.status,
          message: extractGoogleErrorMessage(body) || res.statusText,
        },
      };
    }

    const data = (await res.json()) as PagespeedApiResponse;
    const parsed = parsePagespeedResponse(url, strategy, data);
    return { ok: true, data: parsed };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: { kind: "timeout" } };
    }
    return {
      ok: false,
      error: {
        kind: "network",
        message: err instanceof Error ? err.message : "Unknown network error",
      },
    };
  }
}

function extractGoogleErrorMessage(body: string): string {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    /* not JSON */
  }
  return body.slice(0, 200);
}

// ─── Lighthouse response shape (loose — Google adds fields over time) ─

type LighthouseAudit = {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  numericValue?: number;
  details?: {
    type?: string;
    overallSavingsMs?: number;
    overallSavingsBytes?: number;
    headings?: Array<{
      key?: string;
      label?: string;
      valueType?: string;
      granularity?: number;
      subItemsHeading?: { key?: string; valueType?: string };
    }>;
    items?: Array<Record<string, unknown>>;
  };
};

type LighthouseCategory = {
  id?: string;
  title?: string;
  description?: string;
  score?: number;
  auditRefs?: Array<{
    id: string;
    group?: string;
    weight?: number;
  }>;
};

type LighthouseCategoryGroup = {
  title?: string;
  description?: string;
};

type PagespeedApiResponse = {
  id?: string;
  loadingExperience?: {
    overall_category?: string;
    metrics?: Record<
      string,
      { percentile?: number; category?: string }
    >;
  };
  lighthouseResult?: {
    finalUrl?: string;
    lighthouseVersion?: string;
    fetchTime?: string;
    runWarnings?: string[];
    runtimeError?: { code?: string; message?: string };
    audits?: Record<string, LighthouseAudit>;
    categories?: Record<string, LighthouseCategory>;
    categoryGroups?: Record<string, LighthouseCategoryGroup>;
    fullPageScreenshot?: { screenshot?: { data?: string } };
  };
};

// ─── Parser ───────────────────────────────────────────────────────────

function parsePagespeedResponse(
  inputUrl: string,
  strategy: PagespeedStrategy,
  data: PagespeedApiResponse,
): PagespeedDetails {
  const lh = data.lighthouseResult;
  const allAudits = lh?.audits ?? {};
  const lhCategories = lh?.categories ?? {};
  const categoryGroups = lh?.categoryGroups ?? {};

  // Metrics — pulled once from the performance category audit table.
  const metrics: PagespeedMetric[] = METRIC_IDS_ORDERED.flatMap((id) => {
    const a = allAudits[id];
    if (!a || typeof a.numericValue !== "number") return [];
    return [
      {
        id: a.id,
        title: a.title,
        value: a.numericValue,
        displayValue: a.displayValue ?? formatMetricValue(id, a.numericValue),
        score: typeof a.score === "number" ? a.score : 0,
      },
    ];
  });

  // Build one PagespeedCategory per Lighthouse category id we care about.
  const categories: PagespeedCategory[] = CATEGORIES_ORDERED.flatMap((id) => {
    const cat = lhCategories[id];
    if (!cat) return [];

    const auditRefs = cat.auditRefs ?? [];
    // Build PagespeedAudits from refs (the ref carries weight + group; the
    // audit carries the actual data).
    const builtAudits = auditRefs.flatMap((ref) => {
      const audit = allAudits[ref.id];
      if (!audit) return [];
      return [
        {
          built: buildAudit(audit, ref.weight ?? 0),
          group: ref.group,
        },
      ];
    });

    // Bucket by score-display-mode first (manual / notApplicable handled
    // separately), then by group for the actively-flagged ones.
    const passed: PagespeedAudit[] = [];
    const manual: PagespeedAudit[] = [];
    const notApplicable: PagespeedAudit[] = [];
    const groupBuckets = new Map<string | "_ungrouped", PagespeedAudit[]>();

    for (const { built, group } of builtAudits) {
      // Skip audits Lighthouse hides — informative metrics like LCP element
      // are useful but only when the category is performance; they belong
      // in metrics not groups. Hidden audits (group === "hidden") never
      // surface in the panel UI.
      if (group === "hidden") continue;
      if (group === "metrics") continue;

      if (built.scoreDisplayMode === "manual") {
        manual.push(built);
        continue;
      }
      if (built.scoreDisplayMode === "notApplicable") {
        notApplicable.push(built);
        continue;
      }
      if (built.score === 1 || built.scoreDisplayMode === "informative") {
        // Informative audits with no items (e.g. "Network round trips") still
        // belong in passed when there's nothing to flag.
        if (
          built.scoreDisplayMode === "informative" &&
          (built.items.length > 0 || built.displayValue)
        ) {
          // Has something to show → treat as a finding
          pushToGroup(groupBuckets, group, built);
          continue;
        }
        passed.push(built);
        continue;
      }
      pushToGroup(groupBuckets, group, built);
    }

    // Build groups in a stable order — known groups first, then alphabetic.
    const groups: PagespeedCategoryGroup[] = [];
    for (const [groupId, audits] of groupBuckets) {
      if (audits.length === 0) continue;
      const groupMeta =
        groupId !== "_ungrouped" ? categoryGroups[groupId] : null;

      // Sort: failing (score < 1 or null) first by savings desc, then by
      // weight desc, then by title.
      audits.sort((a, b) => {
        const aFail = (a.score ?? 1) < 1 ? 0 : 1;
        const bFail = (b.score ?? 1) < 1 ? 0 : 1;
        if (aFail !== bFail) return aFail - bFail;
        if (a.savingsMs !== b.savingsMs) return b.savingsMs - a.savingsMs;
        if (a.weight !== b.weight) return b.weight - a.weight;
        return a.title.localeCompare(b.title);
      });

      groups.push({
        id: groupId === "_ungrouped" ? `${id}__ungrouped` : groupId,
        title:
          groupMeta?.title ??
          (groupId === "_ungrouped"
            ? "Other"
            : prettifyGroupId(String(groupId))),
        description: groupMeta?.description ?? null,
        audits,
      });
    }
    // Ordering: Insights / Diagnostics first if present, then categorical.
    groups.sort((a, b) => groupOrder(a.id) - groupOrder(b.id));

    passed.sort((a, b) => a.title.localeCompare(b.title));
    manual.sort((a, b) => a.title.localeCompare(b.title));
    notApplicable.sort((a, b) => a.title.localeCompare(b.title));

    const score =
      typeof cat.score === "number" ? Math.round(cat.score * 100) : null;

    return [
      {
        id,
        title: cat.title ?? CATEGORY_FALLBACK_TITLES[id],
        score,
        description: cat.description ?? null,
        groups,
        passed,
        manual,
        notApplicable,
      },
    ];
  });

  const screenshot = lh?.fullPageScreenshot?.screenshot?.data ?? null;

  const lx = data.loadingExperience;
  const fieldData: PagespeedLoadingExperience | null = lx
    ? {
        category: normaliseCategory(lx.overall_category),
        metrics: Object.entries(lx.metrics ?? {}).map(([key, m]) => ({
          id: key,
          label: prettifyCruxMetric(key),
          percentile: m?.percentile ?? null,
          category: normaliseCategory(m?.category),
        })),
      }
    : null;

  const runtimeError =
    lh?.runtimeError?.code && lh.runtimeError.code !== "NO_ERROR"
      ? {
          code: lh.runtimeError.code,
          message: lh.runtimeError.message ?? "Lighthouse runtime error",
        }
      : null;

  return {
    url: inputUrl,
    finalUrl: lh?.finalUrl ?? inputUrl,
    strategy,
    fetchedAt: lh?.fetchTime ?? new Date().toISOString(),
    lighthouseVersion: lh?.lighthouseVersion ?? "unknown",
    metrics,
    categories,
    screenshot,
    fieldData,
    runWarnings: lh?.runWarnings ?? [],
    runtimeError,
  };
}

function buildAudit(audit: LighthouseAudit, weight: number): PagespeedAudit {
  const rawHeadings = audit.details?.headings ?? [];
  const headings: AuditHeading[] = rawHeadings.flatMap((h) =>
    h.key && h.label && h.valueType
      ? [
          {
            key: h.key,
            label: h.label,
            valueType: h.valueType,
            granularity: h.granularity,
            subItemsHeading: h.subItemsHeading?.key
              ? {
                  key: h.subItemsHeading.key,
                  valueType: h.subItemsHeading.valueType,
                }
              : undefined,
          },
        ]
      : [],
  );

  return {
    id: audit.id,
    title: audit.title,
    description: audit.description,
    score: audit.score,
    scoreDisplayMode: audit.scoreDisplayMode,
    displayValue: audit.displayValue ?? null,
    numericValue: audit.numericValue ?? null,
    savingsMs: audit.details?.overallSavingsMs ?? 0,
    savingsBytes: audit.details?.overallSavingsBytes ?? 0,
    headings,
    items: audit.details?.items ?? [],
    weight,
  };
}

function pushToGroup(
  buckets: Map<string | "_ungrouped", PagespeedAudit[]>,
  group: string | undefined,
  audit: PagespeedAudit,
): void {
  const key = group ?? "_ungrouped";
  const list = buckets.get(key);
  if (list) list.push(audit);
  else buckets.set(key, [audit]);
}

const KNOWN_GROUP_ORDER: Record<string, number> = {
  insights: 1,
  "load-opportunities": 2,
  diagnostics: 3,
  "a11y-navigation": 10,
  "a11y-aria": 11,
  "a11y-color-contrast": 12,
  "a11y-names-labels": 13,
  "a11y-best-practices": 14,
  "a11y-tables-lists": 15,
  "a11y-audio-video": 16,
  "a11y-language": 17,
  "best-practices-trust-safety": 20,
  "best-practices-ux": 21,
  "best-practices-browser-compat": 22,
  "best-practices-general": 23,
  "seo-mobile": 30,
  "seo-content": 31,
  "seo-crawl": 32,
};

function groupOrder(groupId: string): number {
  return KNOWN_GROUP_ORDER[groupId] ?? 100;
}

function prettifyGroupId(id: string): string {
  return id
    .replace(/^a11y-|^best-practices-|^seo-/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const CATEGORY_FALLBACK_TITLES: Record<PagespeedCategoryId, string> = {
  performance: "Performance",
  accessibility: "Accessibility",
  "best-practices": "Best Practices",
  seo: "SEO",
};

function normaliseCategory(
  raw: string | undefined,
): "FAST" | "AVERAGE" | "SLOW" | null {
  if (raw === "FAST" || raw === "AVERAGE" || raw === "SLOW") return raw;
  return null;
}

function prettifyCruxMetric(id: string): string {
  const map: Record<string, string> = {
    FIRST_CONTENTFUL_PAINT_MS: "First Contentful Paint",
    LARGEST_CONTENTFUL_PAINT_MS: "Largest Contentful Paint",
    FIRST_INPUT_DELAY_MS: "First Input Delay",
    INTERACTION_TO_NEXT_PAINT: "Interaction to Next Paint",
    CUMULATIVE_LAYOUT_SHIFT_SCORE: "Cumulative Layout Shift",
    EXPERIMENTAL_TIME_TO_FIRST_BYTE: "Time to First Byte",
  };
  return map[id] ?? id;
}

function formatMetricValue(id: string, value: number): string {
  if (id === "cumulative-layout-shift") return value.toFixed(3);
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
  return `${Math.round(value)} ms`;
}
