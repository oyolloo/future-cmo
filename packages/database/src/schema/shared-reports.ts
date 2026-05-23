import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "./users";

/**
 * Tokenized share links for Marketing Audit Reports. Token is URL-safe and
 * unguessable; anyone with the link can view (no auth). Each row pins the
 * list of placeIds that were included when the share was created, so the
 * report renders consistently even if the user's prospect list changes
 * later.
 */
export const sharedReports = pgTable(
  "shared_reports",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    token: varchar("token", { length: 40 }).notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeIds: jsonb("place_ids").notNull().$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (table) => [
    index("shared_reports_token_idx").on(table.token),
    index("shared_reports_user_id_idx").on(table.userId),
  ],
);

export type SharedReport = typeof sharedReports.$inferSelect;
export type NewSharedReport = typeof sharedReports.$inferInsert;
