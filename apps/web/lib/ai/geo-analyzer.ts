import "server-only";

import { z } from "zod";

import {
  chatJson,
  CHEAP_MODELS,
  FREE_MODELS,
  type ChatUsage,
} from "./openrouter";
import type { ExtractedContent } from "../audit/page-content";

// ─── Schema ──────────────────────────────────────────────────────────

const QueryVerdictSchema = z.object({
  /** The natural-language query a user would type into ChatGPT / Perplexity. */
  query: z.string().min(5).max(200),
  /** How likely an AI engine would cite this page when answering this query. */
  likelihood: z.enum(["high", "medium", "low", "very-low"]),
  /** 0–100 numeric grade for sorting + averaging. */
  score: z.number().int().min(0).max(100),
  /** One-sentence reason for the grade. */
  reasoning: z.string().min(10).max(400),
  /** What the page is missing that would raise the citation chance. */
  missingPiece: z.string().min(10).max(400),
  /**
   * The kind of citation this page is structurally suited for.
   *   factoid     : single fact / definition (one-liner answers)
   *   listicle    : enumerated list, ranking, comparison
   *   how-to      : step-by-step instructions
   *   opinion     : subjective take, brand position
   *   data        : statistics, data visualisation, original research
   */
  citationType: z.enum(["factoid", "listicle", "how-to", "opinion", "data", "general"]),
});

export const GeoAnalysisSchema = z.object({
  /** Overall GEO verdict — one sentence for the report header. */
  oneLiner: z.string().min(10).max(280),
  /**
   * 0–100 GEO score. Average of per-query scores weighted by likelihood
   * (high counts more than low). LLM computes this — don't recompute.
   */
  geoScore: z.number().int().min(0).max(100),
  /** What the page does WELL for AI citation — 1–3 strengths. */
  strengths: z.array(z.string().min(5).max(280)).min(0).max(3),
  /** Per-query simulation results — 6–10 queries. */
  queries: z.array(QueryVerdictSchema).min(3).max(12),
  /** Sample AI search snippet — how an LLM might quote this page in an answer. */
  sampleSnippet: z.string().min(10).max(400),
  /** Top 3 page-level changes that would lift GEO score the most. */
  topImprovements: z
    .array(
      z.object({
        title: z.string().min(3).max(160),
        how: z.string().min(10).max(400),
      }),
    )
    .min(1)
    .max(5),
});

export type GeoAnalysis = z.infer<typeof GeoAnalysisSchema>;
export type QueryVerdict = z.infer<typeof QueryVerdictSchema>;

export type GeoAnalysisResult =
  | {
      ok: true;
      data: GeoAnalysis;
      meta: { modelUsed: string; usage: ChatUsage };
    }
  | { ok: false; error: { message: string } };

// ─── Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Generative Engine Optimization (GEO) analyst. \
You simulate how AI search engines (ChatGPT, Claude, Perplexity, Gemini, Bing Copilot) \
decide which pages to CITE in their answers. \
You think like the retrieval-augmented generation (RAG) systems behind those engines: \
relevance to the query, factual specificity, structured snippets, recency, brand authority, \
clear answer-paragraphs. \
Your job is to (a) simulate the likely queries this page targets, (b) grade citation \
likelihood per query, (c) say exactly what's missing to raise each grade. \
Be honest — most pages score below 50 because they aren't structured for AI citation.`;

export async function analyzeGeo(input: {
  url: string;
  content: ExtractedContent;
  targetTopic?: string;
}): Promise<GeoAnalysisResult> {
  const userPrompt = buildPrompt(input);

  const result = await chatJson(
    [{ role: "user", content: userPrompt }],
    GeoAnalysisSchema,
    {
      systemPrompt: SYSTEM_PROMPT,
      models: [...FREE_MODELS, ...CHEAP_MODELS],
      temperature: 0.3,
      maxTokens: 3500,
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
        message:
          "OPENROUTER_API_KEY not configured — add it to apps/web/.env to enable GEO analysis.",
      },
    };
  }
  if (result.error.kind === "all_models_failed") {
    const last = result.error.attempts[result.error.attempts.length - 1];
    return {
      ok: false,
      error: {
        message: `All ${result.error.attempts.length} model fallbacks failed. Last: ${last?.model} (${last?.status}) ${last?.message ?? ""}`,
      },
    };
  }
  return { ok: false, error: { message: "Unknown analyzer error." } };
}

function buildPrompt(input: {
  url: string;
  content: ExtractedContent;
  targetTopic?: string;
}): string {
  const { content } = input;
  const headingsBlock =
    content.headings.length === 0
      ? "(none)"
      : content.headings
          .map((h) => `${"#".repeat(h.level)} ${h.text}`)
          .join("\n");

  const topicHint = input.targetTopic
    ? `\nUser-provided target topic: "${input.targetTopic}" — bias query simulation around this.\n`
    : "";

  return `Simulate AI-search citation likelihood for this page:

URL: ${input.url}
Title: ${content.title ?? "(none)"}
Meta description: ${content.metaDescription ?? "(none)"}
Word count: ${content.wordCount}
${topicHint}
HEADINGS:
${headingsBlock}

CONTENT (cleaned body text, may be truncated):
"""
${content.text}
"""

Return a JSON object with this exact shape:
{
  "oneLiner": "one-line verdict on this page's overall GEO posture",
  "geoScore": <integer 0–100, weighted average of per-query scores>,
  "strengths": ["what this page does well for AI citation — 0 to 3 items"],
  "queries": [
    {
      "query": "natural-language query a real user would type into ChatGPT/Perplexity",
      "likelihood": "high" | "medium" | "low" | "very-low",
      "score": <integer 0–100>,
      "reasoning": "one sentence on why this score",
      "missingPiece": "what's missing on this page that would raise the score",
      "citationType": "factoid" | "listicle" | "how-to" | "opinion" | "data" | "general"
    }
  ],
  "sampleSnippet": "a short paragraph showing how an AI engine MIGHT quote this page in an answer if it cited the page (write it as the AI would render it)",
  "topImprovements": [
    { "title": "Top improvement", "how": "concrete fix in <30 min" }
  ]
}

Constraints:
- queries: 6–10 plausible queries — vary the user intent (informational / commercial / how-to / comparison / definition)
- likelihood distribution should reflect reality — most pages have 1–2 high-likelihood and several low ones
- score per query should align with likelihood:
    high  : 75–95
    medium: 45–74
    low   : 20–44
    very-low: 0–19
- geoScore: weighted average — give 2× weight to "high" queries (they matter more for ranking signal)
- missingPiece must be SPECIFIC (mention the actual section, fact, schema, or structure missing)
- topImprovements: 3–5 page-level changes — actionable, not "improve content"
- sampleSnippet: write it the way AI would actually quote — short, factual, attributed
- No markdown, no code fences — JSON only.`;
}
