"use server";

import { revalidatePath } from "next/cache";

import {
  createProspect,
  createSharedReport,
  findProspectByUserAndPlace,
} from "@kit/database";

import { scorePlace, type ConversionScore } from "@/lib/audit/score";
import { readAuthCookie } from "@/lib/auth/cookies";
import { verifyJwt } from "@/lib/auth/jwt";
import { requireUser } from "@/lib/auth/session";
import {
  autocompleteLocations,
  getPlaceDetails,
  searchPlaces,
  type LocationSuggestion,
  type PlaceDetails,
  type PlaceSummary,
} from "@/lib/maps/places";

import { searchSchema, type SearchInput } from "./schema";

export type SearchResultRow = PlaceSummary & {
  score: ConversionScore;
  alreadySaved: boolean;
  /** Set when alreadySaved is true so the UI can link to the audit page. */
  savedProspectId: string | null;
};

export type SearchActionState =
  | { ok: true; results: SearchResultRow[]; query: SearchInput }
  | { ok: false; error: { code: string; message: string } };

export async function searchAction(
  input: SearchInput,
): Promise<SearchActionState> {
  const user = await requireUser();

  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parsed.error.issues[0]?.message ?? "Invalid search input",
      },
    };
  }

  try {
    const places = await searchPlaces(parsed.data);

    // Mark which results are already saved by this user so the UI can
    // disable "+ Add" on those rows.
    const checks = await Promise.all(
      places.map((p) => findProspectByUserAndPlace(user.id, p.placeId)),
    );

    const results: SearchResultRow[] = places.map((place, i) => {
      const existing = checks[i];
      return {
        ...place,
        score: scorePlace(place),
        alreadySaved: existing !== null,
        savedProspectId: existing?.id ?? null,
      };
    });

    return { ok: true, results, query: parsed.data };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Search failed unexpectedly";
    return {
      ok: false,
      error: { code: "SEARCH_FAILED", message },
    };
  }
}

export type AddProspectInput = {
  placeId: string;
  name: string;
  formattedAddress: string | null;
  phone: string | null;
  website: string | null;
};

export type AddProspectState =
  | { ok: true; prospectId: string }
  | { ok: false; error: { code: string; message: string } };

export async function addProspectAction(
  input: AddProspectInput,
): Promise<AddProspectState> {
  const user = await requireUser();

  if (!input.placeId || !input.name) {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Missing required fields" },
    };
  }

  // Idempotent: don't duplicate if the user already saved this place.
  const existing = await findProspectByUserAndPlace(user.id, input.placeId);
  if (existing) {
    return { ok: true, prospectId: existing.id };
  }

  try {
    const prospect = await createProspect({
      userId: user.id,
      placeId: input.placeId,
      name: input.name,
      formattedAddress: input.formattedAddress,
      phone: input.phone,
      website: input.website,
    });
    revalidatePath("/gm-prospecting");
    return { ok: true, prospectId: prospect.id };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not save prospect";
    return { ok: false, error: { code: "SAVE_FAILED", message } };
  }
}

/**
 * Debounced location autocomplete used by the search form.
 * Returns at most ~5 suggestions, fails soft to an empty list so the UI
 * never breaks if the Maps key is missing or quota is exceeded.
 *
 * Auth here uses a lightweight JWT-only check (no DB lookup). Fast typing
 * fires several Server Actions per second; calling `requireUser` (which
 * hits Postgres via `findUserById`) was creating pool pressure on the
 * Supabase transaction-mode pooler and surfacing as random "Failed query"
 * errors. The autocomplete only returns public Maps suggestions — knowing
 * a valid session cookie exists is enough cost-protection.
 */
export async function autocompleteLocationAction(
  query: string,
): Promise<LocationSuggestion[]> {
  const token = await readAuthCookie();
  const payload = token ? await verifyJwt(token) : null;
  if (!payload) return [];
  return autocompleteLocations(query);
}

export type CreateShareLinkState =
  | { ok: true; token: string; url: string }
  | { ok: false; error: { code: string; message: string } };

/**
 * Mint a public share token for a Marketing Audit Report. Token is a 16-char
 * URL-safe base64 string (96 random bits — unguessable). Anyone with the
 * link can view the report at /r/[token] without auth.
 */
export async function createShareLinkAction(
  placeIds: string[],
): Promise<CreateShareLinkState> {
  const user = await requireUser();

  if (!Array.isArray(placeIds) || placeIds.length === 0) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "Add at least one business before sharing",
      },
    };
  }

  // Cap at 100 to match the Limit dropdown ceiling; anything larger is a
  // bad request from the UI.
  const unique = Array.from(new Set(placeIds)).slice(0, 100);

  try {
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(12).toString("base64url"); // 16 chars
    const row = await createSharedReport({
      token,
      userId: user.id,
      placeIds: unique,
    });
    return {
      ok: true,
      token: row.token,
      url: `/r/${row.token}`,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not create share link";
    return { ok: false, error: { code: "SHARE_FAILED", message } };
  }
}

export type GetPlaceDetailsState =
  | { ok: true; details: PlaceDetails }
  | { ok: false; error: { code: string; message: string } };

/**
 * Fetch full Place Details for the row-click Dialog. Same lightweight
 * JWT-only auth as autocomplete — the Dialog only shows public Google
 * Places data, and a stale cookie shouldn't bring down the whole UI.
 * 30-day cache lives in `places_cache`.
 */
export async function getPlaceDetailsAction(
  placeId: string,
): Promise<GetPlaceDetailsState> {
  const token = await readAuthCookie();
  const payload = token ? await verifyJwt(token) : null;
  if (!payload) {
    return {
      ok: false,
      error: { code: "UNAUTHORIZED", message: "Sign in to view details" },
    };
  }

  if (!placeId || typeof placeId !== "string") {
    return {
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "Missing placeId" },
    };
  }

  try {
    const details = await getPlaceDetails(placeId);
    return { ok: true, details };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not load place details";
    return { ok: false, error: { code: "FETCH_FAILED", message } };
  }
}
