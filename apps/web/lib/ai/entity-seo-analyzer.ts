import "server-only";

import { z } from "zod";

import {
  chatJson,
  CHEAP_MODELS,
  FREE_MODELS,
  type ChatUsage,
} from "./openrouter";
import type { ExtractedContent } from "../audit/page-content";
import type { EntitySignal } from "../audit/entity-signals";

// ─── Schema ──────────────────────────────────────────────────────────

const EntityAssessmentSchema = z.object({
  name: z.string().min(1).max(160),
  /** Person · Organization · Product · Place · Concept · Brand · Tool · Event · Other. */
  type: z.string().min(2).max(40),
  /** Approximate mention count in the content. */
  mentions: z.number().int().min(1).max(500),
  /**
   * Is the entity clearly defined / disambiguated in context?
   *  - clear      : reader/LLM can tell exactly which "X" this is
   *  - ambiguous  : multiple real-world entities share this name; context doesn't fix it
   *  - weak       : entity is named but never explained — drive-by mention
   */
  disambiguation: z.enum(["clear", "ambiguous", "weak"]),
  /** Suggested authoritative URL to link (Wikipedia, Wikidata, official site). Null if not applicable. */
  authoritativeUrl: z.string().nullable(),
  /** Why this entity matters for the page's topic — one sentence. */
  importance: z.string().min(10).max(280),
  /** Specific schema / sameAs / linking recommendation — actionable. */
  recommendation: z.string().min(10).max(400),
});

const EntityActionSchema = z.object({
  title: z.string().min(3).max(160),
  detail: z.string().min(10).max(400),
  /** Which entity this action targets, if specific to one. */
  entity: z.string().nullable(),
});

export const EntityAnalysisSchema = z.object({
  /** One-line verdict for the report header. */
  oneLiner: z.string().min(10).max(280),
  /** 0–100 — overall entity authority of the page. */
  entityAuthorityScore: z.number().int().min(0).max(100),
  /** The page's primary entity (the brand/product/topic it's *about*). */
  primaryEntity: z.string().min(1).max(160),
  /** Per-entity assessments, ordered by importance. */
  entities: z.array(EntityAssessmentSchema).min(1).max(15),
  /** Top concrete improvements (entity-level, not generic SEO advice). */
  actions: z.array(EntityActionSchema).min(1).max(6),
  /** Entities that should be internally linked to other pages on the site. */
  internalLinkingOpportunities: z.array(z.string().min(2).max(160)).max(8),
});

export type EntityAnalysis = z.infer<typeof EntityAnalysisSchema>;
export type EntityAssessment = z.infer<typeof EntityAssessmentSchema>;

export type EntityAnalysisResult =
  | {
      ok: true;
      data: EntityAnalysis;
      meta: { modelUsed: string; usage: ChatUsage };
    }
  | { ok: false; error: { message: string } };

// ─── Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert in Entity SEO and knowledge graph optimisation. \
You audit how a web page handles its named entities — brands, people, products, places, concepts. \
Modern search (Google + LLM-based engines) ranks pages by their alignment with the knowledge graph: \
strong, disambiguated entities with sameAs links to authoritative sources (Wikipedia / Wikidata / official sites) \
build the entity-page relationship. \
Be direct and specific. Cite the actual entity by name. Recommend concrete schema markup or linking targets.`;

export async function analyzeEntitySeo(input: {
  url: string;
  content: ExtractedContent;
  existingSignals: EntitySignal[];
}): Promise<EntityAnalysisResult> {
  const userPrompt = buildPrompt(input);

  const result = await chatJson(
    [{ role: "user", content: userPrompt }],
    EntityAnalysisSchema,
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
          "OPENROUTER_API_KEY not configured — add it to apps/web/.env to enable entity analysis.",
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
  existingSignals: EntitySignal[];
}): string {
  const { content, existingSignals } = input;

  const signalsSummary =
    existingSignals.length === 0
      ? "(no JSON-LD entity markup found — major Entity SEO gap)"
      : existingSignals
          .map(
            (s) =>
              `- ${s.type}: "${s.name}" — sameAs: ${
                s.sameAs.length > 0
                  ? s.sameAs.join(", ").slice(0, 250)
                  : "(none)"
              }${s.hasIdentifier ? " · has @id" : ""}`,
          )
          .join("\n");

  const headingsBlock =
    content.headings.length === 0
      ? "(none)"
      : content.headings
          .map((h) => `${"#".repeat(h.level)} ${h.text}`)
          .join("\n");

  return `Audit this page's Entity SEO — focus on how named entities are handled, NOT topical breadth:

URL: ${input.url}
Title: ${content.title ?? "(none)"}
Meta description: ${content.metaDescription ?? "(none)"}
Word count: ${content.wordCount}

HEADINGS:
${headingsBlock}

EXISTING JSON-LD ENTITY MARKUP (sameAs, @id, @type):
${signalsSummary}

CONTENT (cleaned body text, may be truncated):
"""
${content.text}
"""

Return a JSON object with this exact shape:
{
  "oneLiner": "one-line verdict on this page's entity alignment with the knowledge graph",
  "entityAuthorityScore": <integer 0–100>,
  "primaryEntity": "the main brand/product/concept this page is about",
  "entities": [
    {
      "name": "Entity name as it appears in content",
      "type": "Person | Organization | Product | Place | Concept | Brand | Tool | Event | Other",
      "mentions": <approx mention count>,
      "disambiguation": "clear" | "ambiguous" | "weak",
      "authoritativeUrl": "https://en.wikipedia.org/wiki/... | https://www.wikidata.org/... | official site URL | null",
      "importance": "one sentence on why this entity matters for the page",
      "recommendation": "concrete fix — e.g. 'Add Organization JSON-LD with sameAs to Wikipedia + Twitter' OR 'Internally link first mention to /about page'"
    }
  ],
  "actions": [
    { "title": "Top-level improvement", "detail": "how to implement it",
      "entity": "specific entity name OR null" }
  ],
  "internalLinkingOpportunities": [
    "Entity name that has a hub page on the site and should be internally linked"
  ]
}

Constraints:
- entities: 5–12 of the most page-relevant named entities (NOT generic concepts like "marketing")
- Prefer entities that map to a real Wikipedia / Wikidata page or have a clear official site
- disambiguation = "weak" if the entity is name-dropped without explanation
- authoritativeUrl = null when no clear external authority exists (e.g. minor local brand)
- actions: 3–5 entity-specific improvements (NOT "add more content" — actual schema/link recommendations)
- entityAuthorityScore: scoring guide:
    < 30 = no JSON-LD entity markup + entities barely defined
    30–60 = some entities defined, weak/missing sameAs, no Organization schema
    60–80 = Organization schema + most entities defined, some sameAs links
    > 80 = comprehensive entity markup with sameAs to Wikipedia/Wikidata
- No markdown, no code fences — JSON only.`;
}
