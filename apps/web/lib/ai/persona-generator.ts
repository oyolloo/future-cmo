import "server-only";

import { z } from "zod";

import {
  chatJson,
  CHEAP_MODELS,
  FREE_MODELS,
  type ChatUsage,
} from "./openrouter";

// ─── Schema ──────────────────────────────────────────────────────────

const PersonaSchema = z.object({
  name: z.string().min(2).max(60),
  age: z.string().min(1).max(20),
  role: z.string().min(3).max(120),
  location: z.string().min(2).max(80),

  demographics: z.object({
    income: z.string().min(2).max(80),
    education: z.string().min(2).max(80),
    familyStatus: z.string().min(2).max(80),
  }),

  psychographics: z.object({
    values: z.array(z.string().min(2).max(80)).min(2).max(5),
    interests: z.array(z.string().min(2).max(80)).min(2).max(5),
    personality: z.string().min(10).max(200),
  }),

  painPoints: z.array(z.string().min(10).max(280)).min(2).max(5),
  goals: z.array(z.string().min(10).max(280)).min(2).max(4),
  objections: z.array(z.string().min(10).max(280)).min(2).max(4),

  channels: z.object({
    primary: z.array(z.string().min(2).max(60)).min(1).max(4),
    secondary: z.array(z.string().min(2).max(60)).max(4),
  }),

  messaging: z.object({
    hook: z.string().min(10).max(200),
    tone: z.string().min(5).max(100),
    avoidWords: z.array(z.string().min(2).max(40)).max(5),
    sampleHeadline: z.string().min(10).max(160),
  }),

  quote: z.string().min(10).max(280),
});

export const PersonaSetSchema = z.object({
  personas: z.array(PersonaSchema).min(2).max(4),
  marketContext: z.string().min(20).max(400),
});

export type Persona = z.infer<typeof PersonaSchema>;
export type PersonaSet = z.infer<typeof PersonaSetSchema>;

export type PersonaGeneratorResult =
  | { ok: true; data: PersonaSet; meta: { modelUsed: string; usage: ChatUsage } }
  | { ok: false; error: { message: string } };

// ─── Prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior marketing strategist who creates buyer personas for businesses. \
Your personas are realistic, specific, and immediately actionable — not generic templates. \
Each persona represents a distinct segment of the target market with different motivations, pain points, and buying triggers. \
You base personas on real-world behavioral patterns, not stereotypes. \
Every field must be filled with specific, concrete details — not vague platitudes.`;

export async function generatePersonas(input: {
  businessType: string;
  targetMarket: string;
  currentCustomers?: string;
  productPrice?: string;
  count?: number;
}): Promise<PersonaGeneratorResult> {
  const prompt = buildPrompt(input);

  const result = await chatJson(
    [{ role: "user", content: prompt }],
    PersonaSetSchema,
    {
      systemPrompt: SYSTEM_PROMPT,
      models: [...FREE_MODELS, ...CHEAP_MODELS],
      temperature: 0.5,
      maxTokens: 4000,
    },
  );

  if (result.ok) return { ok: true, data: result.data, meta: result.meta };

  if (result.error.kind === "invalid_json") {
    return { ok: false, error: { message: `Invalid JSON: ${result.error.reason.slice(0, 150)}` } };
  }
  if (result.error.kind === "no_api_key") {
    return { ok: false, error: { message: "OPENROUTER_API_KEY not set." } };
  }
  if (result.error.kind === "all_models_failed") {
    return { ok: false, error: { message: "All LLM models failed." } };
  }
  return { ok: false, error: { message: "Unknown error." } };
}

function buildPrompt(input: {
  businessType: string;
  targetMarket: string;
  currentCustomers?: string;
  productPrice?: string;
  count?: number;
}): string {
  const n = input.count ?? 3;
  return `Generate ${n} distinct buyer personas for this business:

BUSINESS: ${input.businessType}
TARGET MARKET: ${input.targetMarket}
${input.currentCustomers ? `CURRENT CUSTOMERS: ${input.currentCustomers}` : ""}
${input.productPrice ? `PRICE POINT: ${input.productPrice}` : ""}

Return JSON:
{
  "marketContext": "one paragraph on the overall market dynamics for this business",
  "personas": [
    {
      "name": "realistic first name + last initial",
      "age": "e.g. 34",
      "role": "job title or life role",
      "location": "city/region",
      "demographics": {
        "income": "range e.g. $60k–$80k",
        "education": "level",
        "familyStatus": "e.g. married, 2 kids"
      },
      "psychographics": {
        "values": ["what they care about"],
        "interests": ["hobbies, topics"],
        "personality": "one sentence on their personality style"
      },
      "painPoints": ["specific frustrations related to this product/service"],
      "goals": ["what they want to achieve"],
      "objections": ["why they might NOT buy"],
      "channels": {
        "primary": ["where they spend time — Instagram, LinkedIn, etc."],
        "secondary": ["less frequent channels"]
      },
      "messaging": {
        "hook": "one-line pitch that would grab their attention",
        "tone": "how to talk to them — formal, casual, urgent, etc.",
        "avoidWords": ["words/phrases that turn them off"],
        "sampleHeadline": "ad/email headline that would convert them"
      },
      "quote": "something this persona would actually say about their problem"
    }
  ]
}

Constraints:
- Each persona must be DISTINCTLY different (different age, role, motivation, buying trigger)
- Pain points must be specific to THIS business, not generic
- Channels must reflect where THIS demographic actually spends time in 2026
- Quote should sound like a real person talking, not marketing copy
- No markdown, no code fences — JSON only.`;
}
