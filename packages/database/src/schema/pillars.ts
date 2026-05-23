import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Top-level domain of the Digital Marketing Ecosystem taxonomy.
 * Seeded once from the user's curated Google Sheet (column B).
 */
export const pillars = pgTable(
  "pillars",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    slug: varchar("slug", { length: 80 }).notNull().unique(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("pillars_position_idx").on(table.position)],
);

export type Pillar = typeof pillars.$inferSelect;
export type NewPillar = typeof pillars.$inferInsert;
