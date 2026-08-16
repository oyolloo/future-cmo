import { NextResponse, type NextRequest } from "next/server";
import { withApiKey, handleCorsPreFlight } from "@/lib/api/middleware";
import { fetchExtendedReviews } from "@/lib/maps/extra-reviews";

export function OPTIONS() { return handleCorsPreFlight(); }

/**
 * Review intelligence for a single place: how recently it was reviewed and
 * whether the owner answers. Both are things the Places API never exposes and
 * a browser extension can only read slowly, one listing at a time.
 *
 * Backed by the shared place-reviews cache, so the same restaurant looked up
 * by many customers costs one scrape rather than one per customer.
 */

/** Reviews we look at when scoring reply behaviour. */
const SAMPLE_SIZE = 20;
/** Cache older than this is refetched — a stale snapshot cannot answer "reviewed in the last 24 hours". */
const DEFAULT_MAX_AGE_HOURS = 24;

function daysSince(iso: string, now: number): number | null {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

export async function POST(req: NextRequest) {
  return withApiKey(req, "place-reviews", async () => {
    const body = await req.json().catch(() => null);
    const placeId = typeof body?.placeId === "string" ? body.placeId : null;
    const mapsUrl = typeof body?.mapsUrl === "string" ? body.mapsUrl : null;

    if (!placeId && !mapsUrl) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Provide 'placeId' or 'mapsUrl'" } },
        { status: 400 },
      );
    }

    const maxAgeHours = Number.isFinite(body?.maxAgeHours)
      ? Math.max(1, Math.min(24 * 30, Number(body.maxAgeHours)))
      : DEFAULT_MAX_AGE_HOURS;

    // Sorting by newest is what makes the first review meaningful, and caps
    // the scrape at two pages instead of paginating the whole history.
    const opts = { pages: 2, sort: "newest" as const };

    let result = await fetchExtendedReviews({ googleMapsUri: mapsUrl, placeId }, opts);

    // A cache entry older than the caller's tolerance cannot answer a
    // recency question — a review posted since the snapshot is simply absent.
    if (result.ok && result.data.cached) {
      const ageHours = (Date.now() - Date.parse(result.data.fetchedAt)) / 3_600_000;
      if (ageHours > maxAgeHours) {
        result = await fetchExtendedReviews(
          { googleMapsUri: mapsUrl, placeId },
          { ...opts, forceRefresh: true },
        );
      }
    }

    if (!result.ok) {
      const notFound = result.error.kind === "no_reviews";
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: notFound ? "NO_REVIEWS" : "TOOL_ERROR",
            message: `Review lookup failed: ${result.error.kind}`,
          },
        },
        { status: notFound ? 404 : 502 },
      );
    }

    const { reviews, cached, fetchedAt } = result.data;
    const sample = reviews.slice(0, SAMPLE_SIZE);
    const now = Date.now();

    let lastReviewDays: number | null = null;
    let replied = 0;
    for (const r of sample) {
      if (r.ownerResponse) replied++;
      if (!r.publishedAt) continue;
      const d = daysSince(r.publishedAt, now);
      // Sorted newest-first, but don't trust the order — take the minimum.
      if (d != null && (lastReviewDays == null || d < lastReviewDays)) lastReviewDays = d;
    }

    return NextResponse.json({
      ok: true,
      data: {
        lastReviewDays,
        ownerReplied: sample.length ? replied > 0 : null,
        replyRate: sample.length ? Math.round((replied / sample.length) * 100) : null,
        reviewsScanned: sample.length,
        totalReviewsFetched: reviews.length,
        cached,
        fetchedAt,
      },
    });
  });
}
