import "server-only";

import { z } from "zod";

import {
  chatJson,
  CHEAP_MODELS,
  FREE_MODELS,
  type ChatUsage,
} from "./openrouter";
import type { AppListingData } from "../audit/shopify-app-listing";

// ─── Schema ──────────────────────────────────────────────────────────

const SectionAuditSchema = z.object({
  score: z.number().int().min(0).max(100),
  verdict: z.string().min(5).max(280),
  issues: z.array(z.string().min(5).max(280)).max(5),
  suggestions: z.array(z.string().min(5).max(280)).max(5),
});

const KeywordSchema = z.object({
  keyword: z.string().min(2).max(80),
  /** present = already in the listing; missing = should add. */
  status: z.enum(["present", "missing"]),
  importance: z.enum(["high", "medium", "low"]),
});

const CompetitorInsightSchema = z.object({
  insight: z.string().min(10).max(400),
  actionable: z.string().min(10).max(280),
});

export const ListingOptimizationSchema = z.object({
  oneLiner: z.string().min(10).max(280),
  overallScore: z.number().int().min(0).max(100),

  title: SectionAuditSchema,
  description: SectionAuditSchema,
  pricing: SectionAuditSchema,
  visuals: SectionAuditSchema,
  seo: SectionAuditSchema,

  /** Suggested rewritten title — ready to copy-paste. */
  suggestedTitle: z.string().min(5).max(120),
  /** Suggested rewritten tagline. */
  suggestedTagline: z.string().min(10).max(200),
  /** First paragraph rewrite — hook that makes merchants stop scrolling. */
  suggestedHook: z.string().min(20).max(500),

  keywords: z.array(KeywordSchema).min(3).max(15),

  competitorInsights: z.array(CompetitorInsightSchema).max(5),

  /** Priority action list — top 5 things to fix right now. */
  priorityActions: z.array(
    z.object({
      title: z.string().min(3).max(160),
      impact: z.enum(["high", "medium", "low"]),
      effort: z.enum(["quick", "medium", "heavy"]),
      detail: z.string().min(10).max(400),
    }),
  ).min(3).max(7),
});

export type ListingOptimization = z.infer<typeof ListingOptimizationSchema>;

export type ListingOptimizationResult =
  | {
      ok: true;
      data: ListingOptimization;
      meta: { modelUsed: string; usage: ChatUsage };
    }
  | { ok: false; error: { message: string } };

// ─── Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Shopify App Store optimization expert with 10+ years of experience. \
You audit app listings for conversion rate optimization — your changes directly impact install rates. \
You think like a merchant browsing the App Store: what makes them click Install vs scroll past? \
You know Shopify's App Store ranking algorithm favors: keyword relevance in title/description, \
review quality, "Built for Shopify" badge, clear pricing, strong screenshots, and fast onboarding. \
Be brutally specific. Every suggestion must be copy-paste ready or step-by-step actionable.`;

export async function optimizeListing(
  listing: AppListingData,
): Promise<ListingOptimizationResult> {
  const prompt = buildPrompt(listing);

  const result = await chatJson(
    [{ role: "user", content: prompt }],
    ListingOptimizationSchema,
    {
      systemPrompt: SYSTEM_PROMPT,
      models: [...FREE_MODELS, ...CHEAP_MODELS],
      temperature: 0.3,
      maxTokens: 4000,
    },
  );

  if (result.ok) {
    return { ok: true, data: result.data, meta: result.meta };
  }

  if (result.error.kind === "invalid_json") {
    return {
      ok: false,
      error: {
        message: `LLM returned invalid JSON: ${result.error.reason.slice(0, 200)}`,
      },
    };
  }
  if (result.error.kind === "no_api_key") {
    return {
      ok: false,
      error: {
        message: "OPENROUTER_API_KEY not configured.",
      },
    };
  }
  if (result.error.kind === "all_models_failed") {
    const last = result.error.attempts[result.error.attempts.length - 1];
    return {
      ok: false,
      error: {
        message: `All models failed. Last: ${last?.model} (${last?.status})`,
      },
    };
  }
  return { ok: false, error: { message: "Unknown optimizer error." } };
}

function buildPrompt(listing: AppListingData): string {
  return `Audit this Shopify App Store listing for conversion optimization:

URL: ${listing.url}
APP NAME: ${listing.name ?? "(not found)"}
TAGLINE: ${listing.tagline ?? "(not found)"}
HANDLE: ${listing.handle}
DEVELOPER: ${listing.developerName ?? "(unknown)"}
RATING: ${listing.rating ?? "none"} (${listing.reviewCount ?? "0"} reviews)
BUILT FOR SHOPIFY: ${listing.builtForShopify ? "YES" : "NO"}
PRICING: ${listing.pricing.length > 0 ? listing.pricing.join(" · ") : "(not detected)"}
CATEGORIES: ${listing.categories.length > 0 ? listing.categories.join(", ") : "(none detected)"}
SCREENSHOTS: ${listing.screenshotCount} detected
WORD COUNT: ${listing.wordCount}
HEADINGS IN LISTING: ${listing.headings.slice(0, 15).join(" | ") || "(none)"}

FULL LISTING TEXT (may be truncated):
"""
${listing.description.slice(0, 8000)}
"""

Return a JSON object with this exact shape:
{
  "oneLiner": "one-sentence verdict on this listing's conversion potential",
  "overallScore": <0–100>,
  "title": { "score": <0–100>, "verdict": "...", "issues": ["..."], "suggestions": ["..."] },
  "description": { "score": <0–100>, "verdict": "...", "issues": ["..."], "suggestions": ["..."] },
  "pricing": { "score": <0–100>, "verdict": "...", "issues": ["..."], "suggestions": ["..."] },
  "visuals": { "score": <0–100>, "verdict": "...", "issues": ["..."], "suggestions": ["..."] },
  "seo": { "score": <0–100>, "verdict": "...", "issues": ["..."], "suggestions": ["..."] },
  "suggestedTitle": "ready-to-paste optimized title (max 120 chars)",
  "suggestedTagline": "ready-to-paste optimized tagline",
  "suggestedHook": "rewritten first paragraph — the hook that makes merchants stop scrolling and read more",
  "keywords": [
    { "keyword": "...", "status": "present" | "missing", "importance": "high" | "medium" | "low" }
  ],
  "competitorInsights": [
    { "insight": "what top competitors in this category do better", "actionable": "what to do about it" }
  ],
  "priorityActions": [
    { "title": "...", "impact": "high" | "medium" | "low", "effort": "quick" | "medium" | "heavy", "detail": "..." }
  ]
}

Constraints:
- title/description/pricing/visuals/seo: 1–3 issues + 1–3 suggestions each
- keywords: 8–12 (mix of present + missing)
- priorityActions: 5 most impactful changes, ordered by impact desc
- suggestedTitle: must include the primary keyword merchants would search
- suggestedHook: must lead with the #1 merchant benefit, not a feature list
- scoring: be honest — most listings score 40–65 because they're feature-focused not benefit-focused
- No markdown, no code fences — JSON only.`;
}
