import "server-only";

import { and, eq, gt } from "drizzle-orm";

import { db } from "../client";
import {
  placesCache,
  type NewPlaceCacheRow,
  type PlaceCacheRow,
} from "../schema/places-cache";

/**
 * Read a fresh (non-expired) cache row for the given place_id. Returns null
 * if the row is missing or expired so the caller can re-fetch.
 */
export async function findFreshPlaceCache(
  placeId: string,
): Promise<PlaceCacheRow | null> {
  const rows = await db
    .select()
    .from(placesCache)
    .where(
      and(eq(placesCache.placeId, placeId), gt(placesCache.expiresAt, new Date())),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Insert-or-replace a cache row. Drizzle's onConflictDoUpdate keeps the
 * insert idempotent — repeat fetches after expiry overwrite the prior row.
 */
export async function upsertPlaceCache(
  input: NewPlaceCacheRow,
): Promise<PlaceCacheRow> {
  const [row] = await db
    .insert(placesCache)
    .values(input)
    .onConflictDoUpdate({
      target: placesCache.placeId,
      set: {
        name: input.name,
        formattedAddress: input.formattedAddress,
        phone: input.phone,
        website: input.website,
        rating: input.rating,
        reviewCount: input.reviewCount,
        lat: input.lat,
        lng: input.lng,
        data: input.data,
        fetchedAt: input.fetchedAt,
        expiresAt: input.expiresAt,
      },
    })
    .returning();
  if (!row) throw new Error("upsertPlaceCache: no row returned");
  return row;
}
