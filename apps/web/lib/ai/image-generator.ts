import "server-only";

import { env } from "@kit/shared/env";

// ─── Types ──────────────────────────────────────────────────────────

export type GeneratedImage = {
  url: string;
  revisedPrompt: string | null;
  modelUsed: string;
};

export type ImageGenResult =
  | { ok: true; data: GeneratedImage }
  | { ok: false; error: { message: string } };

export type ImageGenOptions = {
  size?: "1024x1024" | "1792x1024" | "1024x1792";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
};

// ─── Models ─────────────────────────────────────────────────────────

const IMAGE_MODELS = [
  "openai/dall-e-3",
  "openai/dall-e-2",
] as const;

// ─── Generate ───────────────────────────────────────────────────────

export async function generateImage(
  prompt: string,
  options: ImageGenOptions = {},
): Promise<ImageGenResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, error: { message: "OPENROUTER_API_KEY not configured." } };
  }

  const {
    size = "1792x1024",
    quality = "standard",
    style = "vivid",
  } = options;

  for (const model of IMAGE_MODELS) {
    const result = await tryGenerate({
      apiKey,
      model,
      prompt,
      size,
      quality,
      style,
    });
    if (result.ok) return result;
    if (result.error.message.includes("401") || result.error.message.includes("402")) {
      return result;
    }
  }

  return { ok: false, error: { message: "All image generation models failed." } };
}

async function tryGenerate(input: {
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
  quality: string;
  style: string;
}): Promise<ImageGenResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/images/generations", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://future-cmo.app",
        "X-Title": "future-cmo",
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        n: 1,
        size: input.size,
        quality: input.quality,
        style: input.style,
        response_format: "url",
      }),
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: { message: `${res.status}: ${extractError(body) || res.statusText}` },
      };
    }

    const json = (await res.json()) as {
      data?: Array<{ url?: string; revised_prompt?: string }>;
    };
    const img = json.data?.[0];
    if (!img?.url) {
      return { ok: false, error: { message: "No image URL in response." } };
    }

    return {
      ok: true,
      data: {
        url: img.url,
        revisedPrompt: img.revised_prompt ?? null,
        modelUsed: input.model,
      },
    };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: { message: "Image generation timed out (120s)." } };
    }
    return {
      ok: false,
      error: { message: err instanceof Error ? err.message : "Network error" },
    };
  }
}

function extractError(body: string): string {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch { /* ignore */ }
  return body.slice(0, 200);
}
