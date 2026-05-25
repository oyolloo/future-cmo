import "server-only";

import { z } from "zod";

import {
  chatJson,
  VISION_MODELS,
  type ChatMessage,
  type ChatUsage,
} from "./openrouter";

// ─── Schema ──────────────────────────────────────────────────────────

const ImageIssueSchema = z.object({
  area: z.string().min(3).max(120),
  issue: z.string().min(10).max(280),
  fix: z.string().min(10).max(280),
  priority: z.enum(["high", "medium", "low"]),
});

const ImageAnalysisSchema = z.object({
  overallScore: z.number().int().min(0).max(100),
  verdict: z.string().min(10).max(300),

  composition: z.object({
    score: z.number().int().min(0).max(100),
    feedback: z.string().min(10).max(300),
  }),
  typography: z.object({
    score: z.number().int().min(0).max(100),
    feedback: z.string().min(10).max(300),
  }),
  colorAndContrast: z.object({
    score: z.number().int().min(0).max(100),
    feedback: z.string().min(10).max(300),
  }),
  clarity: z.object({
    score: z.number().int().min(0).max(100),
    feedback: z.string().min(10).max(300),
  }),
  brandConsistency: z.object({
    score: z.number().int().min(0).max(100),
    feedback: z.string().min(10).max(300),
  }),

  issues: z.array(ImageIssueSchema).min(1).max(8),

  improvementPrompt: z.string().min(20).max(600),
});

export type ImageAnalysis = z.infer<typeof ImageAnalysisSchema>;
export type ImageIssue = z.infer<typeof ImageIssueSchema>;

export type ImageAnalysisResult =
  | {
      ok: true;
      data: ImageAnalysis;
      meta: { modelUsed: string; usage: ChatUsage };
    }
  | { ok: false; error: { message: string } };

// ─── Analyze ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a world-class visual design critic and marketing image expert. \
You analyze screenshots, banners, app listing images, and marketing creatives with a sharp eye for: \
composition, typography readability, color contrast, visual hierarchy, call-to-action clarity, \
brand consistency, and conversion impact. \
You score honestly — most amateur marketing images score 40–65. \
Your suggestions are specific and actionable — "move the headline 20px up" not "improve layout". \
At the end, write a single detailed prompt that could be given to an AI image generator \
to create an improved version of this image.`;

export async function analyzeImage(
  imageUrl: string,
  context?: string,
): Promise<ImageAnalysisResult> {
  const userContent: ChatMessage["content"] = [
    {
      type: "text",
      text: `Analyze this marketing/app image for design quality and conversion effectiveness.
${context ? `\nContext: ${context}` : ""}

Return JSON with this exact shape:
{
  "overallScore": <0–100>,
  "verdict": "one-sentence summary of the image quality",
  "composition": { "score": <0–100>, "feedback": "..." },
  "typography": { "score": <0–100>, "feedback": "..." },
  "colorAndContrast": { "score": <0–100>, "feedback": "..." },
  "clarity": { "score": <0–100>, "feedback": "..." },
  "brandConsistency": { "score": <0–100>, "feedback": "..." },
  "issues": [
    { "area": "where in the image", "issue": "what's wrong", "fix": "how to fix it", "priority": "high|medium|low" }
  ],
  "improvementPrompt": "A detailed prompt for an AI image generator to create an improved version of this image. Describe the ideal layout, colors, text placement, style, and content. Be specific about dimensions, visual style, and what elements to include."
}

Constraints:
- 3–8 issues, ordered by priority
- Be specific about pixel-level issues (text too small, low contrast areas, cluttered sections)
- improvementPrompt should be detailed enough to generate a similar but improved image
- No markdown, no code fences — JSON only.`,
    },
    {
      type: "image_url",
      image_url: { url: imageUrl },
    },
  ];

  const result = await chatJson(
    [{ role: "user", content: userContent }],
    ImageAnalysisSchema,
    {
      systemPrompt: SYSTEM_PROMPT,
      models: [...VISION_MODELS],
      temperature: 0.3,
      maxTokens: 3000,
      timeoutMs: 90_000,
    },
  );

  if (result.ok) {
    return { ok: true, data: result.data, meta: result.meta };
  }

  if (result.error.kind === "no_api_key") {
    return { ok: false, error: { message: "OPENROUTER_API_KEY not configured." } };
  }
  if (result.error.kind === "invalid_json") {
    return { ok: false, error: { message: `Invalid JSON: ${result.error.reason.slice(0, 200)}` } };
  }
  if (result.error.kind === "all_models_failed") {
    const last = result.error.attempts[result.error.attempts.length - 1];
    return { ok: false, error: { message: `All vision models failed. Last: ${last?.model} (${last?.status})` } };
  }
  return { ok: false, error: { message: "Unknown analysis error." } };
}

// ─── Batch analyze (for listing screenshots) ────────────────────────

export async function analyzeListingScreenshots(
  screenshots: string[],
  appName: string,
): Promise<{
  results: Array<{ url: string; analysis: ImageAnalysis | null; error: string | null }>;
  modelUsed: string | null;
}> {
  const results: Array<{ url: string; analysis: ImageAnalysis | null; error: string | null }> = [];
  let modelUsed: string | null = null;

  // Analyze up to 5 screenshots to keep costs reasonable
  const toAnalyze = screenshots.slice(0, 5);

  for (const url of toAnalyze) {
    const res = await analyzeImage(url, `App Store screenshot for "${appName}" Shopify app`);
    if (res.ok) {
      results.push({ url, analysis: res.data, error: null });
      modelUsed = res.meta.modelUsed;
    } else {
      results.push({ url, analysis: null, error: res.error.message });
    }
  }

  return { results, modelUsed };
}
