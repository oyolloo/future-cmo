import "server-only";

import { and, eq, gt } from "drizzle-orm";

import { db } from "../client";
import {
  placeReviewsCache,
  type NewPlaceReviewsCacheRow,
  type PlaceReviewsCacheRow,
} from "../schema/place-reviews-cache";

/**
 * Look up a fresh cached reviews snapshot for a place. Returns null when
 * no row exists OR the row exists but is past its expiresAt.
 */
export async function findFreshPlaceReviewsCache(
  placeId: string,
  schemaVersion: number,
): Promise<PlaceReviewsCacheRow | null> {
  const rows = await db
    .select()
    .from(placeReviewsCache)
    .where(
      and(
        eq(placeReviewsCache.placeId, placeId),
        eq(placeReviewsCache.schemaVersion, schemaVersion),
        gt(placeReviewsCache.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Upsert (place_id is the primary key). Bumps fetchedAt + expiresAt on
 * conflict — useful when a user clicks "refresh" later.
 */
export async function upsertPlaceReviewsCache(
  input: NewPlaceReviewsCacheRow,
): Promise<void> {
  await db
    .insert(placeReviewsCache)
    .values(input)
    .onConflictDoUpdate({
      target: placeReviewsCache.placeId,
      set: {
        reviews: input.reviews,
        reviewCount: input.reviewCount,
        schemaVersion: input.schemaVersion,
        fetchedAt: input.fetchedAt,
        expiresAt: input.expiresAt,
      },
    });
}
