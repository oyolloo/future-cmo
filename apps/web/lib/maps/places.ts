import "server-only";

import {
  findFreshPlaceCache,
  upsertPlaceCache,
} from "@kit/database";
import { env } from "@kit/shared/env";

const BASE_URL = "https://places.googleapis.com/v1";

const SEARCH_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.location",
  "places.types",
  "places.googleMapsUri",
  // Photos: just the resource name; we construct the media URL client-side.
  "places.photos.name",
].join(",");

export type PlaceSummary = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  lat: number | null;
  lng: number | null;
  types: string[];
  googleMapsUri: string | null;
  /** First photo resource name from Places (`places/.../photos/...`).
   *  Combine with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to load thumbnails:
   *  `https://places.googleapis.com/v1/{photoName}/media?maxHeightPx=...&key=...` */
  photoName: string | null;
};

export type SearchInput = {
  keyword: string;
  location: string;
  radiusKm: number;
  maxResults?: number;
};

type RawPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude: number; longitude: number };
  types?: string[];
  googleMapsUri?: string;
  photos?: Array<{ name?: string }>;
};

/**
 * Places API (New) Text Search. Cost: ~$32/1000 calls at Pro tier; field
 * mask limits what we fetch. Radius is currently passed as a hint inside
 * textQuery — full circle bias requires geocoding the location first
 * (deferred to Phase 2 with the location autocomplete widget).
 */
export async function searchPlaces(input: SearchInput): Promise<PlaceSummary[]> {
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_MAPS_API_KEY is not set — add it to apps/web/.env and restart the dev server",
    );
  }
  if (key.length < 30) {
    throw new Error(
      "GOOGLE_MAPS_API_KEY looks truncated — Google keys are ~39 chars starting with 'AIza'. Check apps/web/.env",
    );
  }

  const textQuery = `${input.keyword} in ${input.location}`;
  const target = input.maxResults ?? 20;
  const PAGE_SIZE = 20; // Places API (New) hard cap per call
  const out: PlaceSummary[] = [];
  let pageToken: string | undefined;

  while (out.length < target) {
    const body: Record<string, unknown> = {
      textQuery,
      maxResultCount: Math.min(PAGE_SIZE, target - out.length),
    };
    if (pageToken) body.pageToken = pageToken;

    const res = await fetch(`${BASE_URL}/places:searchText`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": `${SEARCH_FIELDS},nextPageToken`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(
        `Places search failed (${res.status}): ${detail.slice(0, 200)}`,
      );
    }

    const data = (await res.json()) as {
      places?: RawPlace[];
      nextPageToken?: string;
    };

    for (const p of data.places ?? []) {
      out.push({
        placeId: p.id,
        name: p.displayName?.text ?? "Unknown",
        formattedAddress: p.formattedAddress ?? null,
        phone: p.nationalPhoneNumber ?? null,
        website: p.websiteUri ?? null,
        rating: p.rating ?? null,
        reviewCount: p.userRatingCount ?? null,
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
        types: p.types ?? [],
        googleMapsUri: p.googleMapsUri ?? null,
        photoName: p.photos?.[0]?.name ?? null,
      });
      if (out.length >= target) break;
    }

    if (!data.nextPageToken || out.length >= target) break;
    pageToken = data.nextPageToken;
    // Google docs: nextPageToken has a short delay (~1–2s) before it becomes
    // valid for the follow-up request.
    await new Promise((r) => setTimeout(r, 1500));
  }

  return out.slice(0, target);
}

export type LocationSuggestion = {
  placeId: string;
  text: string;
  mainText: string;
  secondaryText: string;
};

type RawAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

/**
 * Places Autocomplete (New). Cost: ~$2.83 per 1000 requests. We bias the
 * results toward geographic types so suggestions look like "Scottsdale, AZ,
 * USA" rather than individual businesses.
 */
export async function autocompleteLocations(
  query: string,
): Promise<LocationSuggestion[]> {
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key || key.length < 30) return [];

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const body = {
    input: trimmed,
    includedPrimaryTypes: [
      "locality",
      "sublocality",
      "administrative_area_level_1",
      "administrative_area_level_2",
      "country",
      "postal_code",
    ],
  };

  const res = await fetch(`${BASE_URL}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    // Fail soft — empty list keeps the UI usable.
    return [];
  }

  const data = (await res.json()) as RawAutocompleteResponse;

  return (data.suggestions ?? [])
    .map((s) => {
      const p = s.placePrediction;
      if (!p?.placeId) return null;
      return {
        placeId: p.placeId,
        text: p.text?.text ?? p.structuredFormat?.mainText?.text ?? "",
        mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
        secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
      } satisfies LocationSuggestion;
    })
    .filter((s): s is LocationSuggestion => s !== null && s.text.length > 0);
}

const DETAIL_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "location",
  "types",
  "googleMapsUri",
  "photos.name",
  "regularOpeningHours.weekdayDescriptions",
  "regularOpeningHours.openNow",
  "editorialSummary.text",
  "reviews.name",
  "reviews.relativePublishTimeDescription",
  "reviews.rating",
  "reviews.text.text",
  "reviews.originalText.text",
  "reviews.authorAttribution.displayName",
  "reviews.authorAttribution.uri",
  "reviews.authorAttribution.photoUri",
].join(",");

export type PlaceReview = {
  id: string;
  relativeTime: string;
  rating: number;
  text: string;
  authorName: string;
  authorPhotoUri: string | null;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  lat: number | null;
  lng: number | null;
  types: string[];
  googleMapsUri: string | null;
  photoNames: string[];
  weekdayHours: string[];
  openNow: boolean | null;
  editorialSummary: string | null;
  reviews: PlaceReview[];
};

type RawPlaceDetails = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  googleMapsUri?: string;
  photos?: Array<{ name?: string }>;
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  editorialSummary?: { text?: string };
  reviews?: Array<{
    name?: string;
    relativePublishTimeDescription?: string;
    rating?: number;
    text?: { text?: string };
    originalText?: { text?: string };
    authorAttribution?: {
      displayName?: string;
      uri?: string;
      photoUri?: string;
    };
  }>;
};

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (Google TOS ceiling)

function payloadToDetails(
  placeId: string,
  raw: RawPlaceDetails,
): PlaceDetails {
  return {
    placeId,
    name: raw.displayName?.text ?? "Unknown",
    formattedAddress: raw.formattedAddress ?? null,
    phone: raw.nationalPhoneNumber ?? raw.internationalPhoneNumber ?? null,
    website: raw.websiteUri ?? null,
    rating: raw.rating ?? null,
    reviewCount: raw.userRatingCount ?? null,
    lat: raw.location?.latitude ?? null,
    lng: raw.location?.longitude ?? null,
    types: raw.types ?? [],
    googleMapsUri: raw.googleMapsUri ?? null,
    photoNames: (raw.photos ?? [])
      .map((p) => p.name)
      .filter((n): n is string => !!n),
    weekdayHours: raw.regularOpeningHours?.weekdayDescriptions ?? [],
    openNow: raw.regularOpeningHours?.openNow ?? null,
    editorialSummary: raw.editorialSummary?.text ?? null,
    reviews: (raw.reviews ?? []).map((r) => ({
      id: r.name ?? `${placeId}/${Math.random()}`,
      relativeTime: r.relativePublishTimeDescription ?? "",
      rating: r.rating ?? 0,
      text: r.text?.text ?? r.originalText?.text ?? "",
      authorName: r.authorAttribution?.displayName ?? "Anonymous",
      authorPhotoUri: r.authorAttribution?.photoUri ?? null,
    })),
  };
}

/**
 * Fetch full Place Details for the Dialog. Hits the cache first (30-day
 * TTL per Google TOS); on miss, calls Places Details API and persists the
 * raw payload + flattened fields to `places_cache`.
 *
 * Cost: ~$22/1000 calls at Pro tier; aggressive caching makes repeat
 * Dialog opens free.
 */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const cached = await findFreshPlaceCache(placeId);
  if (cached) {
    return payloadToDetails(placeId, cached.data as RawPlaceDetails);
  }

  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key || key.length < 30) {
    throw new Error("GOOGLE_MAPS_API_KEY missing or truncated");
  }

  const res = await fetch(`${BASE_URL}/places/${placeId}`, {
    method: "GET",
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": DETAIL_FIELDS,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(
      `Place Details failed (${res.status}): ${detail.slice(0, 200)}`,
    );
  }

  const raw = (await res.json()) as RawPlaceDetails;
  const details = payloadToDetails(placeId, raw);

  // Persist to cache. Errors here shouldn't surface to the caller — the
  // user already has the fresh data, we just lost the chance to cache it.
  try {
    await upsertPlaceCache({
      placeId,
      name: details.name,
      formattedAddress: details.formattedAddress,
      phone: details.phone,
      website: details.website,
      rating: details.rating != null ? String(details.rating) : null,
      reviewCount:
        details.reviewCount != null ? String(details.reviewCount) : null,
      lat: details.lat != null ? String(details.lat) : null,
      lng: details.lng != null ? String(details.lng) : null,
      data: raw as Record<string, unknown>,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
    });
  } catch (err) {
    console.error("[getPlaceDetails] cache write failed", err);
  }

  return details;
}
