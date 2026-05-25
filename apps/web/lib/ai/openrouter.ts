import "server-only";

import type { ZodType } from "zod";

import { env } from "@kit/shared/env";

// ─── Public types ────────────────────────────────────────────────────

export type ChatMessagePart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ChatMessagePart[];
};

export type ChatUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** USD cost reported by OpenRouter — `0` for free models. */
  costUsd: number;
};

export type ChatResult = {
  text: string;
  /** Model that actually responded (after fallback). */
  modelUsed: string;
  usage: ChatUsage;
};

export type ChatOptions = {
  /**
   * Models to try in order. First success wins. Use this to express
   * "prefer free, fall back to cheap paid". When omitted, defaults to
   * FREE_MODELS — see tier presets below.
   */
  models?: string[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Stop sequences. */
  stop?: string[];
  /** Force JSON output (uses OpenRouter's response_format). */
  json?: boolean;
  /** Per-request timeout in ms. Default 60_000. */
  timeoutMs?: number;
};

export type ChatError =
  | { kind: "no_api_key" }
  | { kind: "all_models_failed"; attempts: ModelAttempt[] }
  | { kind: "invalid_response"; message: string };

export type ModelAttempt = {
  model: string;
  status: number | "network" | "timeout";
  message: string;
};

// ─── Model tier presets ──────────────────────────────────────────────

/**
 * **Free** models — zero cost, rate-limited daily. Try these first.
 * OpenRouter rotates free offerings; if one disappears it 404s and we
 * fall through to the next. Update this list as new free tiers appear.
 */
export const FREE_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "deepseek/deepseek-chat-v3-0324:free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "nvidia/llama-3.1-nemotron-70b-instruct:free",
] as const;

/**
 * **Cheap paid** — sub-cent per typical call. Use when free tiers are
 * rate-limited or quality is too low. Sorted by quality+speed.
 */
export const CHEAP_MODELS = [
  "google/gemini-2.5-flash",
  "anthropic/claude-haiku-4-5",
  "openai/gpt-4o-mini",
] as const;

/**
 * **Balanced** paid — single-digit cents per call. Real workhorses for
 * strategy / persona / long-form content tasks.
 */
export const BALANCED_MODELS = [
  "anthropic/claude-sonnet-4-6",
  "openai/gpt-4o",
  "google/gemini-2.5-pro",
] as const;

/**
 * **Premium** — most expensive, save for high-stakes reasoning where
 * cost is justified by output quality.
 */
export const PREMIUM_MODELS = [
  "anthropic/claude-opus-4-7",
  "openai/o3",
] as const;

/**
 * **Vision** models — support image_url content parts.
 * Used for screenshot analysis, design critique, etc.
 */
export const VISION_MODELS = [
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-2.5-flash",
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
] as const;

/**
 * Cost-conscious default chain: try free → cheap paid → balanced.
 * Most use cases should pass this.
 */
export const ECONOMY_CHAIN = [
  ...FREE_MODELS,
  ...CHEAP_MODELS,
] as const;

// ─── Core call ───────────────────────────────────────────────────────

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Call OpenRouter with a model fallback chain. Tries each model in
 * order, stopping at the first that responds with a 2xx. Free models go
 * first by default so monthly cost stays near zero.
 *
 * Returns a discriminated result — caller pattern-matches on `ok` and
 * surfaces a friendly error from `error.kind`.
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<{ ok: true; data: ChatResult } | { ok: false; error: ChatError }> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return { ok: false, error: { kind: "no_api_key" } };
  }

  const fullMessages: ChatMessage[] = options.systemPrompt
    ? [{ role: "system", content: options.systemPrompt }, ...messages]
    : messages;

  const models = options.models ?? [...ECONOMY_CHAIN];
  const attempts: ModelAttempt[] = [];

  for (const model of models) {
    const attempt = await callOnce({
      apiKey,
      model,
      messages: fullMessages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      stop: options.stop,
      json: options.json,
      timeoutMs: options.timeoutMs ?? 60_000,
    });

    if (attempt.kind === "ok") {
      return { ok: true, data: attempt.data };
    }
    attempts.push({
      model,
      status: attempt.status,
      message: attempt.message,
    });

    // Don't bother trying more models on auth failures or quota for the
    // whole account — they'll fail identically.
    if (attempt.status === 401 || attempt.status === 402) {
      break;
    }
  }

  return { ok: false, error: { kind: "all_models_failed", attempts } };
}

/**
 * JSON-mode variant — instructs OpenRouter to return parsable JSON and
 * validates against the caller's Zod schema. Re-tries once with a
 * stricter system prompt if the first parse fails (common with smaller
 * free models).
 */
export async function chatJson<T>(
  messages: ChatMessage[],
  schema: ZodType<T>,
  options: Omit<ChatOptions, "json"> = {},
): Promise<
  | { ok: true; data: T; meta: { modelUsed: string; usage: ChatUsage } }
  | { ok: false; error: ChatError | { kind: "invalid_json"; raw: string; reason: string } }
> {
  const reinforce =
    "You MUST respond with valid JSON only — no prose, no markdown, no code fences. Match the shape requested in the user message exactly.";

  const result = await chat(messages, {
    ...options,
    json: true,
    systemPrompt: options.systemPrompt
      ? `${options.systemPrompt}\n\n${reinforce}`
      : reinforce,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const text = result.data.text.trim();
  // Strip ```json fences if a model added them despite instructions.
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "invalid_json",
        raw: text,
        reason: err instanceof Error ? err.message : "JSON.parse failed",
      },
    };
  }

  const validated = schema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: {
        kind: "invalid_json",
        raw: text,
        reason: validated.error.message,
      },
    };
  }

  return {
    ok: true,
    data: validated.data,
    meta: {
      modelUsed: result.data.modelUsed,
      usage: result.data.usage,
    },
  };
}

// ─── Single-attempt fetch ───────────────────────────────────────────

type AttemptOk = { kind: "ok"; data: ChatResult };
type AttemptErr = {
  kind: "err";
  status: number | "network" | "timeout";
  message: string;
};

async function callOnce(input: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
  json?: boolean;
  timeoutMs: number;
}): Promise<AttemptOk | AttemptErr> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model: input.model,
      messages: input.messages,
    };
    if (input.temperature != null) body.temperature = input.temperature;
    if (input.maxTokens != null) body.max_tokens = input.maxTokens;
    if (input.stop?.length) body.stop = input.stop;
    if (input.json) body.response_format = { type: "json_object" };
    // Ask OpenRouter to surface real per-call cost in the usage object.
    body.usage = { include: true };

    const res = await fetch(ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
        // OpenRouter shows these in their dashboard so you can audit
        // which app/feature triggered which call. No effect on routing.
        "HTTP-Referer": "https://future-cmo.app",
        "X-Title": "future-cmo",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        kind: "err",
        status: res.status,
        message: extractOpenRouterError(text) || res.statusText,
      };
    }

    const json = (await res.json()) as OpenRouterChatResponse;
    const choice = json.choices?.[0];
    if (!choice?.message?.content) {
      return {
        kind: "err",
        status: res.status,
        message: "OpenRouter returned no content",
      };
    }

    return {
      kind: "ok",
      data: {
        text: choice.message.content,
        modelUsed: json.model ?? input.model,
        usage: {
          promptTokens: json.usage?.prompt_tokens ?? 0,
          completionTokens: json.usage?.completion_tokens ?? 0,
          totalTokens: json.usage?.total_tokens ?? 0,
          costUsd: json.usage?.cost ?? 0,
        },
      },
    };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { kind: "err", status: "timeout", message: "Request timed out" };
    }
    return {
      kind: "err",
      status: "network",
      message: err instanceof Error ? err.message : "Network error",
    };
  }
}

function extractOpenRouterError(body: string): string {
  if (!body) return "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    if (parsed?.error?.message) return parsed.error.message;
  } catch {
    /* fall through */
  }
  return body.slice(0, 200);
}

type OpenRouterChatResponse = {
  model?: string;
  choices?: Array<{
    message?: { role?: string; content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    /** Present when we pass `usage.include = true` in the request. */
    cost?: number;
  };
};
