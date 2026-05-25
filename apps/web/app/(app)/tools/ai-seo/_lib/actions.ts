"use server";

import { requireUser } from "@/lib/auth/session";
import {
  analyzeAISeo,
  type AISeoReport,
} from "@/lib/audit/ai-seo";
import {
  fetchRobotsReport,
  probeLlmsTxt,
} from "@/lib/audit/robots-parser";
import { fetchHtml } from "@/lib/audit/website";
import {
  getAISeoVerdict,
  type AIVerdict,
} from "@/lib/ai/ai-seo-verdict";

export type AISeoState =
  | {
      ok: true;
      data: {
        report: AISeoReport;
        verdict: AIVerdict | null;
        verdictError: string | null;
        durationMs: number;
      };
    }
  | { ok: false; error: { message: string } };

export async function auditAISeoAction(
  rawUrl: string,
): Promise<AISeoState> {
  await requireUser();

  const url = normaliseUrl(rawUrl);
  if (!url) {
    return {
      ok: false,
      error: { message: "Enter a valid URL (e.g. https://example.com)." },
    };
  }

  const domain = extractDomain(url);
  if (!domain) {
    return {
      ok: false,
      error: { message: "Couldn't extract a domain from the URL." },
    };
  }

  const started = Date.now();

  // HTML fetch + robots check + llms.txt probe — all independent, run
  // in parallel. The LLM verdict has to wait for HTML (needs the probe
  // signals) so it kicks off after.
  const [html, robotsResult, hasLlmsTxt] = await Promise.all([
    fetchHtml(url, 12_000),
    fetchRobotsReport(domain),
    probeLlmsTxt(domain),
  ]);

  if (!html) {
    return {
      ok: false,
      error: {
        message:
          "Couldn't fetch the page HTML — site may be down, blocking us, or behind a paywall / login.",
      },
    };
  }

  const report = analyzeAISeo(url, url, html, robotsResult.report, hasLlmsTxt);

  // LLM verdict is best-effort — never block the report on it.
  const verdictResult = await getAISeoVerdict({
    url,
    finalUrl: url,
    score: report.score,
    signals: report.signals,
    checks: report.checks,
  });

  return {
    ok: true,
    data: {
      report,
      verdict: verdictResult.ok ? verdictResult.data : null,
      verdictError: verdictResult.ok ? null : verdictResult.error.message,
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

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}
