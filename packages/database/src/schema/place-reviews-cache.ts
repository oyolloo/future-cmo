import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Snapshot of scraped Google Maps reviews for a place. Populated by the
 * "Load all reviews" action and reused for subsequent opens to avoid
 * repeatedly hammering Google (anti-scraping + rate-limit + IP-ban risk).
 *
 * Schema notes:
 *   - `placeId` is the Google Places ChIJ-format ID (same as
 *     `places_cache.placeId`). Not a FK because the table populates
 *     independently — a user may scrape reviews before opening Place
 *     Details, or vice versa.
 *   - `reviews` stores the full `ExtendedReview[]` shape from
 *     `apps/web/lib/maps/extra-reviews.ts`. Versioned via `schemaVersion`
 *     so we can evolve the shape and invalidate stale rows safely.
 *   - `reviewCount` is denormalised for fast "X loaded" labels without
 *     parsing the jsonb on the list view.
 */
export const placeReviewsCache = pgTable(
  "place_reviews_cache",
  {
    placeId: text("place_id").primaryKey(),
    /** Full ExtendedReview[] payload. */
    reviews: jsonb("reviews").notNull(),
    reviewCount: integer("review_count").notNull(),
    /** Snapshot shape version; bump in code if ExtendedReview changes. */
    schemaVersion: integer("schema_version").notNull().default(1),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("place_reviews_cache_expires_at_idx").on(table.expiresAt),
  ],
);

export type PlaceReviewsCacheRow = typeof placeReviewsCache.$inferSelect;
export type NewPlaceReviewsCacheRow = typeof placeReviewsCache.$inferInsert;
