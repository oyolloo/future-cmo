import { sql } from "drizzle-orm";
import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

/**
 * A business the user has saved as a prospect (the "+ Add" action on a
 * search result row). place_id links back to Google's stable ID and to
 * places_cache for re-fetching details.
 *
 * Denormalized snapshot fields (name, address, phone, website) are kept
 * here so a prospect stays readable even if the cache row is purged.
 */
export const prospects = pgTable(
  "prospects",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: varchar("place_id", { length: 255 }).notNull(),

    // snapshot at save-time
    name: varchar("name", { length: 255 }).notNull(),
    formattedAddress: text("formatted_address"),
    phone: varchar("phone", { length: 50 }),
    website: text("website"),

    // CRM-lite metadata
    status: varchar("status", { length: 50 }).notNull().default("new"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("prospects_user_place_unique").on(table.userId, table.placeId),
    index("prospects_user_id_idx").on(table.userId),
    index("prospects_place_id_idx").on(table.placeId),
  ],
);

export type Prospect = typeof prospects.$inferSelect;
export type NewProspect = typeof prospects.$inferInsert;
