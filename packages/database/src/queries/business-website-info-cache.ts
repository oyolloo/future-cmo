import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";

import { db } from "../client";
import {
  businessWebsiteInfoCache,
  type BusinessWebsiteInfoCacheRow,
} from "../schema/business-website-info-cache";

export type WebsiteInfoSlot = "screenshot" | "cms" | "speed" | "domain";

/**
 * Look up a fresh website-info cache row for a place. Returns null when
 * no row exists OR the row is past its expiresAt OR the row's
 * schemaVersion doesn't match.
 */
export async function findFreshBusinessWebsiteInfoCache(
  placeId: string,
  schemaVersion: number,
): Promise<BusinessWebsiteInfoCacheRow | null> {
  const rows = await db
    .select()
    .from(businessWebsiteInfoCache)
    .where(
      and(
        eq(businessWebsiteInfoCache.placeId, placeId),
        eq(businessWebsiteInfoCache.schemaVersion, schemaVersion),
        gt(businessWebsiteInfoCache.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Upsert a single slot (screenshot / cms / speed / domain) for a place.
 * If the row exists, only the named slot is overwritten — siblings keep
 * their existing data. Touches updatedAt + extends expiresAt on every
 * write so a partial scan doesn't expire half-way through.
 *
 * The websiteUrl column is also written so the cache row knows which
 * URL the data was scraped from — invalidate manually if the business
 * changes its website.
 */
export async function upsertBusinessWebsiteInfoSlot<TPayload>(input: {
  placeId: string;
  websiteUrl: string;
  slot: WebsiteInfoSlot;
  payload: TPayload;
  schemaVersion: number;
  expiresAt: Date;
}): Promise<void> {
  const now = new Date();
  const baseRow = {
    placeId: input.placeId,
    websiteUrl: input.websiteUrl,
    screenshot: null as unknown,
    cms: null as unknown,
    speed: null as unknown,
    domain: null as unknown,
    [input.slot]: input.payload as unknown,
    schemaVersion: input.schemaVersion,
    updatedAt: now,
    expiresAt: input.expiresAt,
  };

  // On conflict (existing row), update ONLY the targeted slot + websiteUrl
  // + timestamps. Other slots keep their existing values via `excluded.*`
  // referencing the row we tried to insert (which is null for those).
  // Workaround: spell out the per-slot setter to preserve siblings.
  await db
    .insert(businessWebsiteInfoCache)
    .values(baseRow)
    .onConflictDoUpdate({
      target: businessWebsiteInfoCache.placeId,
      set: {
        websiteUrl: input.websiteUrl,
        schemaVersion: input.schemaVersion,
        updatedAt: now,
        expiresAt: input.expiresAt,
        // Only set the targeted slot — siblings unchanged.
        [input.slot]: input.payload as unknown,
      },
    });
}

/**
 * Hard-delete a cache row. Used when the user clicks "Refresh" with a
 * different website URL than what's cached (invalidates stale data).
 */
export async function deleteBusinessWebsiteInfoCache(
  placeId: string,
): Promise<void> {
  await db
    .delete(businessWebsiteInfoCache)
    .where(eq(businessWebsiteInfoCache.placeId, placeId));
}

/**
 * Periodic cleanup — drop expired rows. Not auto-called; wire to a cron
 * later if the table grows. The expires_at index makes this O(N expired).
 */
export async function pruneExpiredBusinessWebsiteInfoCache(): Promise<number> {
  const result = await db.execute(
    sql`DELETE FROM business_website_info_cache WHERE expires_at < NOW()`,
  );
  return Number(result.count ?? 0);
}
