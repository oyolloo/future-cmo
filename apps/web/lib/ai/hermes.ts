import "server-only";

import { env } from "@kit/shared/env";

// ─── Types ──────────────────────────────────────────────────────────

export type HermesMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type HermesResult =
  | { ok: true; text: string; modelUsed: string }
  | { ok: false; error: { message: string } };

export type HermesOptions = {
  /** Multi-turn conversation key — Hermes remembers across calls with same key. */
  conversation?: string;
  /** Override model. Default: "hermes-agent". */
  model?: string;
  /** Per-request timeout in ms. Default 120_000 (agents can take longer). */
  timeoutMs?: number;
  /** Enable streaming (returns full text, not chunks). */
  stream?: false;
};

// ─── Core ───────────────────────────────────────────────────────────

/**
 * Call Hermes agent — supports tools, memory, multi-turn conversations.
 * Use for complex agentic tasks. For simple "prompt in, text out", use
 * FreeLLMAPI instead (faster, no agent overhead).
 *
 * SECURITY: Never expose `HERMES_API_KEY` to the browser. Always call
 * through a server action or API route.
 */
export async function askHermes(
  messages: HermesMessage[],
  options: HermesOptions = {},
): Promise<HermesResult> {
  const apiKey = env.HERMES_API_KEY;
  if (!apiKey) {
    return { ok: false, error: { message: "HERMES_API_KEY not configured" } };
  }

  const endpoint = `${env.HERMES_BASE_URL}/chat/completions`;
  const model = options.model ?? "hermes-agent";
  const timeoutMs = options.timeoutMs ?? 120_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (options.conversation) {
      headers["X-Hermes-Session-Key"] = options.conversation;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: { message: `Hermes ${res.status}: ${text.slice(0, 300) || res.statusText}` },
      };
    }

    const json = (await res.json()) as {
      model?: string;
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return { ok: false, error: { message: "Hermes returned no content" } };
    }

    return { ok: true, text: content, modelUsed: json.model ?? model };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: { message: "Hermes request timed out" } };
    }
    return {
      ok: false,
      error: { message: err instanceof Error ? err.message : "Network error" },
    };
  }
}
