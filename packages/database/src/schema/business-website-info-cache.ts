import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Cache for the right-sidebar Website Information scan on a business
 * detail page. Each slot (screenshot · cms · speed · domain) is stored
 * independently so partial successes still cache — a failed screenshot
 * doesn't block CMS/speed/domain results from being saved + reused.
 *
 * Keyed on placeId (Google's ChIJ-format ID, same as in places_cache).
 * No FK because this row populates lazily — a placeId may exist here
 * before it exists in any other table.
 *
 * 30-day TTL — website tech stack + hosting are slow-moving. Speed
 * scores arguably want a shorter TTL but unified TTL keeps the schema
 * simpler; user can hit "Refresh" to force a re-scan.
 */
export const businessWebsiteInfoCache = pgTable(
  "business_website_info_cache",
  {
    placeId: text("place_id").primaryKey(),
    websiteUrl: text("website_url").notNull(),

    // Each slot is jsonb (matches the corresponding server-action
    // success payload). Null = not yet fetched / last fetch failed.
    screenshot: jsonb("screenshot"),
    cms: jsonb("cms"),
    speed: jsonb("speed"),
    domain: jsonb("domain"),

    /** Bump in code when any slot's shape changes — stale rows ignored. */
    schemaVersion: integer("schema_version").notNull().default(1),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("business_website_info_cache_expires_at_idx").on(table.expiresAt),
  ],
);

export type BusinessWebsiteInfoCacheRow =
  typeof businessWebsiteInfoCache.$inferSelect;
export type NewBusinessWebsiteInfoCacheRow =
  typeof businessWebsiteInfoCache.$inferInsert;
