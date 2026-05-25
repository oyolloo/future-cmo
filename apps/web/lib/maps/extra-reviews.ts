import "server-only";

import {
  findFreshPlaceReviewsCache,
  upsertPlaceReviewsCache,
} from "@kit/database";

/**
 * Bump when the ExtendedReview shape changes — cached rows with an older
 * schemaVersion will be ignored by `findFresh*` and re-scraped.
 */
const SCHEMA_VERSION = 1;
/** Cache TTL: 7 days. Reviews trickle in slowly; weekly refresh is plenty. */
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Public types ────────────────────────────────────────────────────

export type ExtendedReview = {
  id: string;
  /** ISO timestamp of original publish (best-effort — Google's format varies). */
  publishedAt: string | null;
  lastEditedAt: string | null;
  author: {
    name: string;
    profileUrl: string | null;
    photoUrl: string | null;
  };
  rating: number;
  text: string | null;
  language: string | null;
  /** Owner / business reply, when present. */
  ownerResponse: {
    text: string;
    publishedAt: string | null;
    lastEditedAt: string | null;
  } | null;
  /** Photo URLs attached to the review, when present. */
  images: string[];
};

export type ExtraReviewsError =
  | { kind: "invalid_url" }
  | { kind: "no_url" }
  | { kind: "scraper_failed"; message: string }
  | { kind: "no_reviews" }
  | { kind: "url_resolve_failed"; message: string };

// ─── Loader ──────────────────────────────────────────────────────────

/**
 * Fetch extended reviews (well past Google Places API's 5-review cap)
 * by scraping the public Google Maps page via the YasogaN scraper. Returns
 * owner replies too — something the official API never exposes.
 *
 * Trade-offs vs Places API:
 *   - Slow (~3–8 s per page of 10 reviews)
 *   - Google can rate-limit datacenter IPs (Vercel egress) — works locally,
 *     production may need residential proxies down the road
 *   - No caching layer yet; caller hits this fresh on every request
 *
 * Cost: $0 (no Google API call). Risk: Google's anti-scraping might block.
 */
export type ExtendedReviewsResult = {
  reviews: ExtendedReview[];
  /** Whether the data came from the DB cache (false = freshly scraped). */
  cached: boolean;
  /** Timestamp of the original scrape (cache fetchedAt or now). */
  fetchedAt: string;
};

/**
 * Cheap cache lookup used by server components to seed initial state —
 * if a fresh snapshot exists, the page can render straight to the
 * paginated full-reviews view instead of showing the "Load all reviews"
 * button. Returns null on miss / expired / table missing.
 */
export async function getCachedReviews(
  placeId: string,
): Promise<{ reviews: ExtendedReview[]; fetchedAt: string } | null> {
  try {
    const cached = await findFreshPlaceReviewsCache(placeId, SCHEMA_VERSION);
    if (!cached) return null;
    return {
      reviews: cached.reviews as ExtendedReview[],
      fetchedAt: cached.fetchedAt.toISOString(),
    };
  } catch (err) {
    console.error("[getCachedReviews] lookup failed", err);
    return null;
  }
}

export async function fetchExtendedReviews(
  input: {
    googleMapsUri: string | null;
    /** Google Places API ChIJ-format placeId — required for cache key + URL fallback. */
    placeId?: string | null;
  },
  options: {
    /**
     * Pages of reviews to fetch (10 per page). Default "max" — pulls every
     * review the scraper can paginate through. Pass a number to cap.
     */
    pages?: number | "max";
    /** Sort order. */
    sort?: "relevant" | "newest" | "highest_rating" | "lowest_rating";
    /** Skip cache lookup (manual refresh button). */
    forceRefresh?: boolean;
  } = {},
): Promise<
  | { ok: true; data: ExtendedReviewsResult }
  | { ok: false; error: ExtraReviewsError }
> {
  if (!input.googleMapsUri && !input.placeId) {
    return { ok: false, error: { kind: "no_url" } };
  }

  // ── Cache lookup ────────────────────────────────────────────────────
  // Keyed on placeId. Only used when a placeId is available — the cache
  // is unusable without one. 7-day TTL absorbs repeat opens cheaply.
  // Wrapped in try/catch so a missing table (migration not yet applied)
  // degrades to a cache miss instead of crashing the request.
  if (input.placeId && !options.forceRefresh) {
    try {
      const cached = await findFreshPlaceReviewsCache(
        input.placeId,
        SCHEMA_VERSION,
      );
      if (cached) {
        return {
          ok: true,
          data: {
            reviews: cached.reviews as ExtendedReview[],
            cached: true,
            fetchedAt: cached.fetchedAt.toISOString(),
          },
        };
      }
    } catch (err) {
      console.error(
        "[fetchExtendedReviews] cache lookup failed (table missing? apply migration 0006_keen_komodo.sql)",
        err,
      );
    }
  }

  // ── Fresh scrape ────────────────────────────────────────────────────
  // The scraper extracts the place's hex Feature ID (e.g. 0x...:0x...) from
  // the URL using `/!1s([a-zA-Z0-9_:]+)!/g`. We try several URL candidates
  // because Google's response varies by region / consent state / rate
  // limit, and pass a `CONSENT=YES+` cookie to bypass the EU consent wall.
  const resolved = await resolveMapsDataUrl(
    input.googleMapsUri,
    input.placeId ?? null,
  );
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  // Dynamic import — keeps the scraper out of any potential client bundle.
  const mod = await import("google-maps-review-scraper");
  const scraper = mod.scraper;

  let raw: unknown;
  try {
    raw = await scraper(resolved.url, {
      sort_type: options.sort ?? "relevant",
      pages: options.pages != null ? String(options.pages) : "max",
      clean: true,
    });
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "scraper_failed",
        message: err instanceof Error ? err.message : "Unknown scraper error",
      },
    };
  }

  // Scraper returns `0` when nothing found, or an array of ParsedReview.
  if (raw === 0 || !Array.isArray(raw)) {
    return { ok: false, error: { kind: "no_reviews" } };
  }

  const reviews: ExtendedReview[] = raw.flatMap((row) => {
    const parsed = normaliseReview(row);
    return parsed ? [parsed] : [];
  });

  const now = new Date();

  // ── Persist ─────────────────────────────────────────────────────────
  // Best-effort — a cache write failure shouldn't break the response.
  // We require placeId for caching (the cache key) — without it, just
  // return without persisting.
  if (input.placeId) {
    try {
      await upsertPlaceReviewsCache({
        placeId: input.placeId,
        reviews,
        reviewCount: reviews.length,
        schemaVersion: SCHEMA_VERSION,
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      });
    } catch (err) {
      console.error("[fetchExtendedReviews] cache write failed", err);
    }
  }

  return {
    ok: true,
    data: {
      reviews,
      cached: false,
      fetchedAt: now.toISOString(),
    },
  };
}

// ─── Normaliser ──────────────────────────────────────────────────────

type RawReview = {
  review_id?: string;
  time?: { published?: unknown; last_edited?: unknown };
  author?: {
    name?: string;
    profile_url?: string;
    url?: string;
  };
  review?: {
    rating?: number;
    text?: string | null;
    language?: string | null;
  };
  images?: Array<{ url?: string }> | null;
  response?: {
    text?: string | null;
    time?: { published?: unknown; last_edited?: unknown };
  } | null;
};

function normaliseReview(raw: unknown): ExtendedReview | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as RawReview;
  if (!r.review_id || !r.author?.name) return null;

  const rating = r.review?.rating;
  if (typeof rating !== "number") return null;

  const ownerText = r.response?.text;
  const ownerResponse =
    typeof ownerText === "string" && ownerText.trim().length > 0
      ? {
          text: ownerText,
          publishedAt: coerceIso(r.response?.time?.published),
          lastEditedAt: coerceIso(r.response?.time?.last_edited),
        }
      : null;

  return {
    id: r.review_id,
    publishedAt: coerceIso(r.time?.published),
    lastEditedAt: coerceIso(r.time?.last_edited),
    author: {
      name: r.author.name,
      profileUrl: r.author.profile_url ?? null,
      // The scraper's `profile_url` is the author's Google reviewer profile,
      // not a photo URL. Photo URL isn't reliably surfaced in the clean
      // schema; keep null.
      photoUrl: null,
    },
    rating,
    text: r.review?.text ?? null,
    language: r.review?.language ?? null,
    ownerResponse,
    images: Array.isArray(r.images)
      ? r.images.flatMap((img) =>
          img?.url ? [img.url] : [],
        )
      : [],
  };
}

// Feature ID = hex pair like "0x89b7b7bcdecbb1df:0x715969d86d0b76bf"
const FEATURE_ID_RE = /!1s(0x[a-f0-9]+:0x[a-f0-9]+)!/i;
// Looser match for inside HTML — Google embeds it as both `0x...:0x...` and `0x...%3A0x...`.
const FEATURE_ID_INLINE_RE = /(0x[a-f0-9]{8,}(?:%3A|:)0x[a-f0-9]{8,})/gi;

/**
 * Resolve to a Google Maps URL the scraper accepts — one containing
 * `!1s<HexID1>:<HexID2>!`. Tries several URL candidates because Google's
 * response varies by IP region / consent state / rate limit:
 *
 *   1. If the input URL already has !1s, return as-is.
 *   2. Try `/maps/place/?q=place_id:<ChIJ>&hl=en&gl=US` (ChIJ-keyed search).
 *   3. Try the original `googleMapsUri` (?cid=...) URL.
 *   4. Try `/search?q=place_id:<ChIJ>&hl=en&gl=US` (web search fallback).
 *
 * For each candidate: check res.url then scan HTML body for the FID.
 * All requests carry a `CONSENT=YES+` cookie that bypasses Google's
 * EU/global cookie-consent wall (no consent click → no JS hydration →
 * no FID in the HTML otherwise).
 */
async function resolveMapsDataUrl(
  googleMapsUri: string | null,
  placeId: string | null,
): Promise<
  | { ok: true; url: string }
  | { ok: false; error: ExtraReviewsError }
> {
  // Cheap win — caller already has a data URL.
  if (googleMapsUri && FEATURE_ID_RE.test(googleMapsUri)) {
    return { ok: true, url: googleMapsUri };
  }

  const candidates: string[] = [];
  if (placeId) {
    candidates.push(
      `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}&hl=en&gl=US`,
    );
  }
  if (googleMapsUri) {
    const sep = googleMapsUri.includes("?") ? "&" : "?";
    candidates.push(`${googleMapsUri}${sep}hl=en&gl=US`);
  }
  if (placeId) {
    candidates.push(
      `https://www.google.com/search?q=${encodeURIComponent(`place_id:${placeId}`)}&hl=en&gl=US`,
    );
  }

  if (candidates.length === 0) {
    return { ok: false, error: { kind: "no_url" } };
  }

  let lastDiagnostic = "";
  for (const candidate of candidates) {
    const result = await tryResolve(candidate);
    if (result.ok) return result;
    lastDiagnostic = result.diagnostic;
  }

  return {
    ok: false,
    error: {
      kind: "url_resolve_failed",
      message: `Could not extract Feature ID from any candidate URL. Last diagnostic: ${lastDiagnostic || "unknown"}.`,
    },
  };
}

async function tryResolve(
  url: string,
): Promise<{ ok: true; url: string } | { ok: false; diagnostic: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        // Bypass Google's consent wall — without this, EU + many
        // international IPs get the cookie banner page instead of Maps.
        Cookie: "CONSENT=YES+cb.20210720-07-p0.en+FX+410; SOCS=CAESHAgBEhJnd3NfMjAyMzA2MDctMF9SQzIaAmVuIAEaBgiAjpquBg",
      },
      cache: "no-store",
    });

    const finalUrl = res.url || url;
    if (FEATURE_ID_RE.test(finalUrl)) {
      clearTimeout(timer);
      return { ok: true, url: finalUrl };
    }

    const html = await res.text();
    clearTimeout(timer);
    const fid = extractFeatureId(html);
    if (fid) {
      // Synthesise a minimal data URL — only the !1s<FID>! segment matters.
      return {
        ok: true,
        url: `https://www.google.com/maps/place/x/data=!4m1!1s${fid}!`,
      };
    }

    // Detect the consent-wall signature so the diagnostic is actionable.
    const isConsent =
      /consent\.google\.com|Before you continue to Google/i.test(html);
    return {
      ok: false,
      diagnostic: isConsent
        ? `consent wall served by ${new URL(url).host}`
        : `no Feature ID in response (HTTP ${res.status}, ${html.length} bytes)`,
    };
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      diagnostic:
        err instanceof Error && err.name === "AbortError"
          ? "timed out after 12s"
          : err instanceof Error
            ? err.message
            : "unknown error",
    };
  }
}

/** Pull the first hex-pair Feature ID from an HTML body. Looks for both the
 *  literal `0x...:0x...` form and the URL-encoded `0x...%3A0x...` form. */
function extractFeatureId(html: string): string | null {
  FEATURE_ID_INLINE_RE.lastIndex = 0;
  const match = FEATURE_ID_INLINE_RE.exec(html);
  const raw = match?.[1];
  if (!raw) return null;
  // Normalise `%3A` to `:` so the scraper's regex matches.
  return raw.replace(/%3A/i, ":");
}

/**
 * Google's API mixes numeric epoch (ms or µs) and ISO strings for review
 * timestamps. Try to coerce to ISO; return null on failure.
 */
function coerceIso(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === "number") {
    // Google often returns microseconds since epoch — heuristic divide.
    const ms = value > 1e14 ? Math.floor(value / 1000) : value;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}
