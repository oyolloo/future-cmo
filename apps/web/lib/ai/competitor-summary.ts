import "server-only";

import { z } from "zod";

import {
  chatJson,
  CHEAP_MODELS,
  FREE_MODELS,
  type ChatUsage,
} from "./openrouter";
import type { CompetitorResult } from "../audit/competitor-analysis";

export const CompetitorSummarySchema = z.object({
  oneLiner: z.string().min(10).max(280),
  /** Who's winning and why — one paragraph. */
  overview: z.string().min(20).max(600),
  /** Per-competitor one-line verdict. */
  verdicts: z.array(
    z.object({
      domain: z.string(),
      verdict: z.string().min(10).max(280),
      strongestArea: z.string().min(3).max(80),
      weakestArea: z.string().min(3).max(80),
    }),
  ),
  /** Top 5 quickest wins — things the user can do RIGHT NOW. */
  quickWins: z.array(
    z.object({
      title: z.string().min(3).max(160),
      detail: z.string().min(10).max(400),
      targetDomain: z.string().nullable(),
      impact: z.enum(["high", "medium", "low"]),
    }),
  ).min(3).max(7),
});

export type CompetitorSummary = z.infer<typeof CompetitorSummarySchema>;

export type CompetitorSummaryResult =
  | { ok: true; data: CompetitorSummary; meta: { modelUsed: string; usage: ChatUsage } }
  | { ok: false; error: { message: string } };

const SYSTEM_PROMPT = `You are a competitive analysis expert. Given side-by-side audit data \
for 2-3 websites, you identify who's winning on each dimension and surface the quickest wins \
for each site. Be specific — reference actual scores, tech stacks, and domain info from the data.`;

export async function generateCompetitorSummary(
  results: CompetitorResult[],
): Promise<CompetitorSummaryResult> {
  const prompt = buildPrompt(results);

  const res = await chatJson(
    [{ role: "user", content: prompt }],
    CompetitorSummarySchema,
    {
      systemPrompt: SYSTEM_PROMPT,
      models: [...FREE_MODELS, ...CHEAP_MODELS],
      temperature: 0.3,
      maxTokens: 2500,
    },
  );

  if (res.ok) return { ok: true, data: res.data, meta: res.meta };

  if (res.error.kind === "no_api_key") {
    return { ok: false, error: { message: "OPENROUTER_API_KEY not set." } };
  }
  if (res.error.kind === "all_models_failed") {
    return { ok: false, error: { message: "All LLM models failed." } };
  }
  if (res.error.kind === "invalid_json") {
    return { ok: false, error: { message: `Invalid JSON: ${res.error.reason.slice(0, 100)}` } };
  }
  return { ok: false, error: { message: "Unknown error." } };
}

function buildPrompt(results: CompetitorResult[]): string {
  const blocks = results.map((r) => {
    const perfMobile = r.speed?.mobile?.categories.find(c => c.id === "performance")?.score;
    const perfDesktop = r.speed?.desktop?.categories.find(c => c.id === "performance")?.score;
    const cms = r.techStack?.detected.find(
      (t) => t.categories.some((c) => /CMS|Ecommerce/i.test(c)),
    );
    const aiSeoScore = r.aiSeo?.score ?? "N/A";
    const mobileScore = r.mobileFriendly?.score ?? "N/A";

    return `
DOMAIN: ${r.domain}
URL: ${r.url}
Speed: Mobile ${perfMobile ?? "N/A"} · Desktop ${perfDesktop ?? "N/A"}
Mobile-friendliness: ${mobileScore}/100
AI SEO score: ${aiSeoScore}/100
CMS/Platform: ${cms?.name ?? "unknown"}
Tech stack: ${r.techStack?.detected.slice(0, 8).map((t) => t.name).join(", ") ?? "N/A"}
Hosting: ${r.domainInfo?.hosting?.org ?? "unknown"}
Domain expires: ${r.domainInfo?.daysToExpiry != null ? `${r.domainInfo.daysToExpiry}d` : "N/A"}
SPF: ${r.domainInfo?.hasSpf ? "yes" : "no"} · DMARC: ${r.domainInfo?.hasDmarc ? "yes" : "no"}
Error: ${r.error ?? "none"}`;
  });

  return `Compare these ${results.length} websites side by side:
${blocks.join("\n---\n")}

Return JSON:
{
  "oneLiner": "one-sentence verdict on who's winning overall",
  "overview": "one paragraph comparing all sites across dimensions",
  "verdicts": [
    { "domain": "example.com", "verdict": "one-line", "strongestArea": "...", "weakestArea": "..." }
  ],
  "quickWins": [
    { "title": "...", "detail": "...", "targetDomain": "example.com or null", "impact": "high"|"medium"|"low" }
  ]
}
Constraints: 3–5 quick wins, reference actual scores. No markdown. JSON only.`;
}
