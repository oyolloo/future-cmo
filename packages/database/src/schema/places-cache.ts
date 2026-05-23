import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Cached Google Places API responses keyed by place_id.
 *
 * Google's Places API TOS limits how long their data may be stored:
 * place_id (the stable opaque ID) is fine to keep indefinitely, but the
 * derived fields (name, address, phone, reviews, etc.) must be refreshed
 * at least every 30 days. We track `expires_at` so the Maps client knows
 * when a row needs a re-fetch.
 */
export const placesCache = pgTable(
  "places_cache",
  {
    placeId: varchar("place_id", { length: 255 }).primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    formattedAddress: text("formatted_address"),
    phone: varchar("phone", { length: 50 }),
    website: text("website"),
    rating: text("rating"), // stored as text — Google returns floats like 4.7
    reviewCount: text("review_count"),
    lat: text("lat"),
    lng: text("lng"),
    /** Raw payload from Places Details for any field not yet promoted */
    data: jsonb("data").notNull().$type<Record<string, unknown>>(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("places_cache_expires_at_idx").on(table.expiresAt)],
);

export type PlaceCacheRow = typeof placesCache.$inferSelect;
export type NewPlaceCacheRow = typeof placesCache.$inferInsert;
