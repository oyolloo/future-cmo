"use server";

import { requireUser } from "@/lib/auth/session";
import {
  optimizeListing,
  type ListingOptimization,
} from "@/lib/ai/app-listing-optimizer";
import {
  scrapeAppListing,
  type AppListingData,
} from "@/lib/audit/shopify-app-listing";
import {
  runListingChecks,
  type ListingPulse,
} from "@/lib/audit/shopify-listing-checks";

export type ListingOptimizerState =
  | {
      ok: true;
      data: {
        listing: AppListingData;
        pulse: ListingPulse;
        optimization: ListingOptimization | null;
        optimizationError: string | null;
        modelUsed: string | null;
        durationMs: number;
      };
    }
  | { ok: false; error: { message: string } };

export async function optimizeListingAction(
  rawUrl: string,
): Promise<ListingOptimizerState> {
  await requireUser();

  const started = Date.now();

  const scrapeResult = await scrapeAppListing(rawUrl);
  if (!scrapeResult.ok) {
    const e = scrapeResult.error;
    const msg =
      e.kind === "invalid_url"
        ? "Enter a Shopify App Store URL (e.g. https://apps.shopify.com/your-app)."
        : e.kind === "not_found"
          ? "App listing not found (404). Check the URL."
          : e.kind === "fetch_failed"
            ? `Couldn't fetch the listing: ${e.message}`
            : `Parse error: ${e.message}`;
    return { ok: false, error: { message: msg } };
  }

  // Programmatic checks — instant, free.
  const pulse = runListingChecks(scrapeResult.data);

  // LLM optimization — best-effort, may fail.
  const optResult = await optimizeListing(scrapeResult.data).catch(() => null);

  return {
    ok: true,
    data: {
      listing: scrapeResult.data,
      pulse,
      optimization: optResult?.ok ? optResult.data : null,
      optimizationError:
        optResult === null
          ? "LLM analysis failed."
          : optResult.ok
            ? null
            : optResult.error.message,
      modelUsed: optResult?.ok ? optResult.meta.modelUsed : null,
      durationMs: Date.now() - started,
    },
  };
}
