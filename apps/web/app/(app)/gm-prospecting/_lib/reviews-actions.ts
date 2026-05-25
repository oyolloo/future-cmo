"use server";

import {
  fetchExtendedReviews,
  type ExtendedReview,
} from "@/lib/maps/extra-reviews";

export type ExtraReviewsState =
  | {
      ok: true;
      data: {
        reviews: ExtendedReview[];
        cached: boolean;
        fetchedAt: string;
      };
    }
  | { ok: false; error: { message: string } };

/**
 * Public action: fetches extended reviews (with owner replies) for a
 * place. Intentionally unauthenticated so the /r/[token] public share
 * page can also load extra reviews — same risk profile as the rest of
 * the public share view.
 *
 * Cached for 7 days in `place_reviews_cache` keyed by placeId, so
 * repeat clicks across users return instantly without re-scraping.
 */
export async function loadExtraReviewsAction(
  googleMapsUri: string | null,
  placeId: string | null,
  options: { forceRefresh?: boolean } = {},
): Promise<ExtraReviewsState> {
  const result = await fetchExtendedReviews(
    { googleMapsUri, placeId },
    {
      pages: "max",
      sort: "newest",
      forceRefresh: options.forceRefresh,
    },
  );

  if (result.ok) return { ok: true, data: result.data };

  return {
    ok: false,
    error: { message: errorMessage(result.error) },
  };
}

function errorMessage(
  error: import("@/lib/maps/extra-reviews").ExtraReviewsError,
): string {
  switch (error.kind) {
    case "invalid_url":
    case "no_url":
      return "No Google Maps URL on file for this business.";
    case "url_resolve_failed":
      return `Could not resolve the Google Maps URL to a scrapable form: ${error.message}`;
    case "no_reviews":
      return "No additional reviews returned (Google may have rate-limited this request).";
    case "scraper_failed":
      return `Scraper error: ${error.message}`;
  }
}
