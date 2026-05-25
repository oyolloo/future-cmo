import { sql } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const savedPersonas = pgTable("saved_personas", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  businessType: text("business_type").notNull(),
  targetMarket: text("target_market").notNull(),
  /** Full PersonaSet JSON — personas[] + marketContext. */
  snapshot: jsonb("snapshot").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SavedPersonaRow = typeof savedPersonas.$inferSelect;
export type NewSavedPersonaRow = typeof savedPersonas.$inferInsert;
