import "server-only";

import { z } from "zod";

import {
  chatJson,
  CHEAP_MODELS,
  FREE_MODELS,
  type ChatUsage,
} from "./openrouter";
import type {
  AISeoCheck,
  AISeoSignals,
} from "../audit/ai-seo";

// ─── Public types ────────────────────────────────────────────────────

export const AIVerdictSchema = z.object({
  /** Top 3-5 issues holding the page back from being cited by AI engines. */
  issues: z
    .array(
      z.object({
        title: z.string().min(3).max(160),
        why: z.string().min(10).max(400),
      }),
    )
    .min(1)
    .max(7),
  /** Top 3-5 concrete improvements. Each MUST be specific and actionable. */
  improvements: z
    .array(
      z.object({
        title: z.string().min(3).max(160),
        how: z.string().min(10).max(400),
      }),
    )
    .min(1)
    .max(7),
  /** Sample queries this page could plausibly be cited for once improved. */
  potentialQueries: z.array(z.string().min(5).max(200)).min(1).max(8),
  /** One-line verdict for the report header. */
  oneLiner: z.string().min(10).max(280),
});

export type AIVerdict = z.infer<typeof AIVerdictSchema>;

export type AIVerdictResult =
  | {
      ok: true;
      data: AIVerdict;
      meta: { modelUsed: string; usage: ChatUsage };
    }
  | { ok: false; error: { message: string } };

// ─── Prompt builder ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert in Generative Engine Optimization (GEO) and AI Search SEO. \
You audit web pages for their citability by AI engines (ChatGPT, Claude, Perplexity, Gemini, Bing Copilot). \
You are direct, specific, and concrete — no fluff. Every recommendation must be actionable in under 30 minutes. \
You evaluate signals like JSON-LD schema completeness, content structure, brand entity authority, AI-crawler access, \
and citation-friendly formatting.`;

// ─── Run ─────────────────────────────────────────────────────────────

/**
 * Get an LLM verdict on AI-citability for a page. Default chain tries
 * free models first (Gemini 2.0 Flash / DeepSeek / Llama 3.3), falls
 * through to cheap paid (~$0.001 per call) only if every free model is
 * rate-limited or returns invalid JSON.
 */
export async function getAISeoVerdict(input: {
  url: string;
  finalUrl: string;
  score: number;
  signals: AISeoSignals;
  checks: AISeoCheck[];
}): Promise<AIVerdictResult> {
  const promptBody = buildUserPrompt(input);

  const result = await chatJson(
    [{ role: "user", content: promptBody }],
    AIVerdictSchema,
    {
      systemPrompt: SYSTEM_PROMPT,
      models: [...FREE_MODELS, ...CHEAP_MODELS],
      temperature: 0.3, // factual, not creative
      maxTokens: 2000,
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
          "OPENROUTER_API_KEY not configured — programmatic checks still ran, only AI verdict is missing.",
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
  return {
    ok: false,
    error: { message: "Unknown AI verdict error." },
  };
}

function buildUserPrompt(input: {
  url: string;
  finalUrl: string;
  score: number;
  signals: AISeoSignals;
  checks: AISeoCheck[];
}): string {
  const { signals, checks } = input;
  const checkSummary = checks
    .map(
      (c) =>
        `- [${c.status.toUpperCase()}] ${c.label} (${c.weight}/${c.maxWeight}): ${c.detail}`,
    )
    .join("\n");

  const schemaSummary =
    signals.schemas.length === 0
      ? "(none)"
      : signals.schemas
          .map(
            (s) =>
              `${s.type}${s.hasAuthor ? " +author" : ""}${s.hasDateModified ? " +dateModified" : ""}${s.hasSameAs ? " +sameAs" : ""}`,
          )
          .join(", ");

  return `Audit this page for AI search citability:

URL: ${input.finalUrl}
Programmatic score: ${input.score}/100

DETECTED SCHEMAS: ${schemaSummary}

CONTENT STATS:
- H1: ${signals.contentStats.h1Count} · H2: ${signals.contentStats.h2Count} · H3: ${signals.contentStats.h3Count}
- ${signals.contentStats.paragraphCount} paragraphs (avg ${Math.round(signals.contentStats.avgParagraphChars)} chars)
- ${signals.contentStats.wordCount} words total
- ${signals.contentStats.listCount} lists · ${signals.contentStats.tableCount} tables
- Outbound citation links: ${signals.contentStats.outboundLinkCount}
- FAQ pattern detected: ${signals.contentStats.hasFaqPattern ? "yes" : "no"}
- Author bio markup: ${signals.hasAuthorBio ? "yes" : "no"}
- Last-updated signal: ${signals.hasLastUpdated ? "yes" : "no"}
- Open Graph: ${signals.hasOpenGraph ? "yes" : "no"} · Twitter Card: ${signals.hasTwitterCard ? "yes" : "no"}

PROGRAMMATIC CHECKS:
${checkSummary}

Return a JSON object with this exact shape:
{
  "oneLiner": "string — one-sentence verdict on this page's AI citability",
  "issues": [
    { "title": "string", "why": "string — why this blocks citation" }
  ],
  "improvements": [
    { "title": "string", "how": "string — concrete fix in <30 min" }
  ],
  "potentialQueries": [
    "string — natural-language query this page COULD be cited for once improved"
  ]
}

Constraints:
- 3-5 issues and 3-5 improvements (no more)
- Reference the actual signals above — don't give generic advice
- Improvements must be specific (mention the exact schema field, header text, or technique)
- potentialQueries should sound like real user queries to ChatGPT / Perplexity (not keywords)
- No markdown, no code fences — JSON only.`;
}
