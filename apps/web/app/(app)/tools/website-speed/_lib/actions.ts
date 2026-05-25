"use server";

import { requireUser } from "@/lib/auth/session";
import {
  getPagespeedDetails,
  type PagespeedDetails,
  type PagespeedError,
  type PagespeedStrategy,
} from "@/lib/audit/pagespeed-details";

export type RunPagespeedState =
  | { ok: true; data: PagespeedDetails }
  | { ok: false; error: { message: string } };

/**
 * Server Action invoked by the Website Speed tool. Auth-gated so
 * unauthenticated visitors can't burn PageSpeed quota.
 */
export async function runPagespeedAction(
  rawUrl: string,
  strategy: PagespeedStrategy,
): Promise<RunPagespeedState> {
  await requireUser();

  const url = normaliseUrl(rawUrl);
  if (!url) {
    return {
      ok: false,
      error: { message: "Enter a valid URL (e.g. https://example.com)" },
    };
  }

  const result = await getPagespeedDetails(url, strategy);
  if (result.ok) return { ok: true, data: result.data };

  return { ok: false, error: { message: pagespeedErrorMessage(result.error) } };
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

function pagespeedErrorMessage(error: PagespeedError): string {
  switch (error.kind) {
    case "no_api_key":
      return "PageSpeed API is not configured. Set GOOGLE_MAPS_API_KEY with PageSpeed Insights enabled.";
    case "timeout":
      return "PageSpeed took longer than 3 minutes — the page is unusually heavy or Google's analyser is overloaded. Retry in a moment, or try the homepage instead of a deep link.";
    case "http_error":
      // Lighthouse occasionally fails to analyse JS-heavy pages — surface
      // a friendlier message for that specific case.
      if (
        error.status === 500 &&
        /lighthouse returned error/i.test(error.message)
      ) {
        return "Google's Lighthouse couldn't analyse this page (often happens with JS-heavy or slow-loading sites). Retry, or try the homepage instead of a deep link.";
      }
      if (error.status === 400) {
        return `PageSpeed rejected the URL: ${error.message}`;
      }
      if (error.status === 403) {
        return "PageSpeed rejected the request (403). Check that PageSpeed Insights API is enabled and the key has no HTTP-referrer restriction.";
      }
      if (error.status === 429) {
        return "PageSpeed quota exceeded — wait a minute and try again.";
      }
      return `PageSpeed returned ${error.status}: ${error.message}`;
    case "invalid_response":
      return `PageSpeed response was unexpected: ${error.message}`;
    case "network":
      return `Network error: ${error.message}`;
  }
}
