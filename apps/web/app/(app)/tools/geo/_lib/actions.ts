"use server";

import { requireUser } from "@/lib/auth/session";
import {
  analyzeGeo,
  type GeoAnalysis,
} from "@/lib/ai/geo-analyzer";
import {
  extractContent,
  type ExtractedContent,
} from "@/lib/audit/page-content";
import { fetchHtml } from "@/lib/audit/website";

export type GeoState =
  | {
      ok: true;
      data: {
        url: string;
        content: ExtractedContent;
        analysis: GeoAnalysis;
        modelUsed: string;
        durationMs: number;
      };
    }
  | { ok: false; error: { message: string } };

export async function analyzeGeoAction(
  rawUrl: string,
  targetTopic: string,
): Promise<GeoState> {
  await requireUser();

  const url = normaliseUrl(rawUrl);
  if (!url) {
    return {
      ok: false,
      error: { message: "Enter a valid URL (e.g. https://example.com)." },
    };
  }

  const trimmedTopic = targetTopic.trim();
  const topic = trimmedTopic.length > 0 ? trimmedTopic : undefined;

  const started = Date.now();

  const html = await fetchHtml(url, 12_000);
  if (!html) {
    return {
      ok: false,
      error: {
        message:
          "Couldn't fetch the page HTML — site may be down, blocking us, or behind a login.",
      },
    };
  }

  const content = extractContent(html);

  if (content.wordCount < 50) {
    return {
      ok: false,
      error: {
        message: `Only ${content.wordCount} words extracted — page may be a SPA shell that renders content via JS, or behind a paywall.`,
      },
    };
  }

  const result = await analyzeGeo({ url, content, targetTopic: topic });
  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    data: {
      url,
      content,
      analysis: result.data,
      modelUsed: result.meta.modelUsed,
      durationMs: Date.now() - started,
    },
  };
}

function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
