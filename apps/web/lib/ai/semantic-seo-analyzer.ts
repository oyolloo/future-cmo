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

const EntitySchema = z.object({
  name: z.string().min(1).max(120),
  /** Person · Place · Product · Concept · Brand · Tool · Technique · etc. */
  type: z.string().min(2).max(40),
  importance: z.enum(["primary", "supporting", "incidental"]),
});

const MissingEntitySchema = z.object({
  name: z.string().min(1).max(120),
  type: z.string().min(2).max(40),
  why: z.string().min(10).max(400),
});

const SuggestionSchema = z.object({
  topic: z.string().min(3).max(160),
  why: z.string().min(10).max(400),
  sampleAngle: z.string().min(10).max(400),
});

export const SemanticAnalysisSchema = z.object({
  /** One-line summary of what the page is actually about. */
  mainTopic: z.string().min(5).max(280),
  /** 0–100 — how comprehensively the page covers its topic. */
  topicalDepthScore: z.number().int().min(0).max(100),
  /** Plain-English one-line verdict for the report header. */
  oneLiner: z.string().min(10).max(280),
  /** Entities the page already covers — including the main subject. */
  coveredEntities: z.array(EntitySchema).min(1).max(20),
  /** Topically-related entities the page is missing. */
  missingEntities: z.array(MissingEntitySchema).max(15),
  /** Concrete additions that would raise topical authority. */
  suggestedAdditions: z.array(SuggestionSchema).max(8),
  /** Natural-language search queries this page could plausibly rank for. */
  relatedQueries: z.array(z.string().min(5).max(200)).min(1).max(10),
});

export type SemanticAnalysis = z.infer<typeof SemanticAnalysisSchema>;

export type SemanticAnalysisResult =
  | {
      ok: true;
      data: SemanticAnalysis;
      meta: { modelUsed: string; usage: ChatUsage };
    }
  | { ok: false; error: { message: string } };

// ─── Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior SEO strategist who specialises in topical authority and \
semantic SEO. You analyse web pages to determine: \
(1) what semantic entities they cover (people, places, products, concepts, brands, tools), \
(2) what entities they're missing for comprehensive topical coverage, and \
(3) what concrete content additions would raise the page's authority on its topic. \
You think like Google's Knowledge Graph + LLM ranking systems — entity coverage + \
contextual completeness drives modern rankings, not keyword density. \
Be direct, specific, concrete. Cite entities by their proper names.`;

export async function analyzeSemanticSeo(input: {
  url: string;
  content: ExtractedContent;
}): Promise<SemanticAnalysisResult> {
  const userPrompt = buildPrompt(input);

  const result = await chatJson(
    [{ role: "user", content: userPrompt }],
    SemanticAnalysisSchema,
    {
      systemPrompt: SYSTEM_PROMPT,
      models: [...FREE_MODELS, ...CHEAP_MODELS],
      temperature: 0.2,
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
          "OPENROUTER_API_KEY not configured — add it to apps/web/.env to enable semantic analysis.",
      },
    };
  }
  if (result.error.kind === "all_models_failed") {
    const last =
      result.error.attempts[result.error.attempts.length - 1];
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
}): string {
  const { content } = input;
  const headingsBlock =
    content.headings.length === 0
      ? "(none)"
      : content.headings
          .map((h) => `${"#".repeat(h.level)} ${h.text}`)
          .join("\n");

  return `Analyse this page for semantic / topical authority:

URL: ${input.url}
Title: ${content.title ?? "(none)"}
Meta description: ${content.metaDescription ?? "(none)"}
Word count: ${content.wordCount}

HEADINGS:
${headingsBlock}

CONTENT (cleaned body text, may be truncated):
"""
${content.text}
"""

Return a JSON object with this exact shape:
{
  "mainTopic": "one-line summary of the page's primary subject",
  "topicalDepthScore": <integer 0–100>,
  "oneLiner": "one-line verdict on semantic completeness",
  "coveredEntities": [
    { "name": "Entity name", "type": "Person | Place | Product | Concept | Brand | Tool | Technique | Event | Other",
      "importance": "primary" | "supporting" | "incidental" }
  ],
  "missingEntities": [
    { "name": "Entity name", "type": "Person | …", "why": "why a topically-complete article on this subject should mention it" }
  ],
  "suggestedAdditions": [
    { "topic": "Specific sub-topic to add", "why": "what topical gap this fills",
      "sampleAngle": "a concrete angle / paragraph idea, not vague advice" }
  ],
  "relatedQueries": [
    "natural-language search this page COULD rank for once expanded"
  ]
}

Constraints:
- coveredEntities: 5–15 of the most important entities actually present in the content
- missingEntities: 3–8 entities that are topically relevant but absent
- suggestedAdditions: 3–6 concrete content additions (not "add more details" — actual section ideas)
- relatedQueries: 5–8 plausible search queries (not keyword stuffing)
- topicalDepthScore: be honest — thin / one-sided content should score <50
- No markdown, no code fences. JSON only.`;
}
