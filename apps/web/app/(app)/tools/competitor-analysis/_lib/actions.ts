"use server";

import { requireUser } from "@/lib/auth/session";
import {
  auditCompetitor,
  type CompetitorResult,
} from "@/lib/audit/competitor-analysis";
import {
  generateCompetitorSummary,
  type CompetitorSummary,
} from "@/lib/ai/competitor-summary";

export type CompetitorAnalysisState =
  | {
      ok: true;
      data: {
        results: CompetitorResult[];
        summary: CompetitorSummary | null;
        summaryError: string | null;
        durationMs: number;
      };
    }
  | { ok: false; error: { message: string } };

export async function analyzeCompetitorsAction(
  urls: string[],
): Promise<CompetitorAnalysisState> {
  await requireUser();

  const cleaned = urls
    .map((u) => u.trim())
    .filter((u) => u.length > 0);

  if (cleaned.length < 2) {
    return {
      ok: false,
      error: { message: "Enter at least 2 URLs to compare." },
    };
  }
  if (cleaned.length > 5) {
    return {
      ok: false,
      error: { message: "Maximum 5 URLs per comparison." },
    };
  }

  const started = Date.now();

  // Run all competitors in parallel.
  const results = await Promise.all(cleaned.map(auditCompetitor));

  // LLM summary — best-effort.
  const summaryResult = await generateCompetitorSummary(results).catch(
    () => null,
  );

  return {
    ok: true,
    data: {
      results,
      summary: summaryResult?.ok ? summaryResult.data : null,
      summaryError:
        summaryResult === null
          ? "LLM summary failed."
          : summaryResult.ok
            ? null
            : summaryResult.error.message,
      durationMs: Date.now() - started,
    },
  };
}
