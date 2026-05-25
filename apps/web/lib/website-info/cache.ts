import "server-only";

import {
  findFreshBusinessWebsiteInfoCache,
  type BusinessWebsiteInfoCacheRow,
} from "@kit/database";

/** Bump if any slot's payload shape changes — invalidates older cache rows. */
export const WEBSITE_INFO_SCHEMA_VERSION = 1;
/** 30-day TTL — website tech + domain change slowly. */
export const WEBSITE_INFO_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type CachedWebsiteInfo = {
  websiteUrl: string;
  screenshot: unknown;
  cms: unknown;
  speed: unknown;
  domain: unknown;
  updatedAt: string;
};

/**
 * Server-side cache lookup the business detail page calls before
 * rendering — lets the sidebar's Website Information panel skip the
 * "Request" button when a fresh snapshot already exists. Returns null
 * on miss / expired / table missing.
 */
export async function getCachedWebsiteInfo(
  placeId: string,
): Promise<CachedWebsiteInfo | null> {
  try {
    const row = await findFreshBusinessWebsiteInfoCache(
      placeId,
      WEBSITE_INFO_SCHEMA_VERSION,
    );
    if (!row) return null;
    return rowToCached(row);
  } catch (err) {
    console.error("[getCachedWebsiteInfo] lookup failed", err);
    return null;
  }
}

function rowToCached(row: BusinessWebsiteInfoCacheRow): CachedWebsiteInfo {
  return {
    websiteUrl: row.websiteUrl,
    screenshot: row.screenshot,
    cms: row.cms,
    speed: row.speed,
    domain: row.domain,
    updatedAt: row.updatedAt.toISOString(),
  };
}
