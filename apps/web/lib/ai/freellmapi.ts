import "server-only";

import type { ZodType } from "zod";

import { env } from "@kit/shared/env";

import type {
  ChatMessage,
  ChatOptions,
  ChatResult,
  ChatError,
  ChatUsage,
  ModelAttempt,
} from "./openrouter";

// ─── Re-export shared types so callers can import from either provider ─
export type { ChatMessage, ChatOptions, ChatResult, ChatError, ChatUsage };

// ─── Model presets ──────────────────────────────────────────────────

export const AUTO_MODEL = "auto" as const;

// ─── Core call ──────────────────────────────────────────────────────

export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {},
): Promise<{ ok: true; data: ChatResult } | { ok: false; error: ChatError }> {
  const apiKey = env.FREELLMAPI_API_KEY;
  if (!apiKey) {
    return { ok: false, error: { kind: "no_api_key" } };
  }

  const endpoint = `${env.FREELLMAPI_BASE_URL}/chat/completions`;

  const fullMessages: ChatMessage[] = options.systemPrompt
    ? [{ role: "system", content: options.systemPrompt }, ...messages]
    : messages;

  const models = options.models ?? [AUTO_MODEL];
  const attempts: ModelAttempt[] = [];

  for (const model of models) {
    const attempt = await callOnce({
      apiKey,
      endpoint,
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

    if (attempt.status === 401 || attempt.status === 402) break;
  }

  return { ok: false, error: { kind: "all_models_failed", attempts } };
}

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
    meta: { modelUsed: result.data.modelUsed, usage: result.data.usage },
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
  endpoint: string;
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

    const res = await fetch(input.endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { kind: "err", status: res.status, message: text.slice(0, 200) || res.statusText };
    }

    const json = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return { kind: "err", status: res.status, message: "FreeLLMAPI returned no content" };
    }

    return {
      kind: "ok",
      data: {
        text: content,
        modelUsed: json.model ?? input.model,
        usage: {
          promptTokens: json.usage?.prompt_tokens ?? 0,
          completionTokens: json.usage?.completion_tokens ?? 0,
          totalTokens: json.usage?.total_tokens ?? 0,
          costUsd: 0,
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
