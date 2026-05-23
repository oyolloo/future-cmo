import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { subPillars } from "./sub-pillars";

/**
 * Leaf node of the taxonomy (sheet column D) — e.g. "Keyword Difficulty",
 * "Prompt Engineering", "Schema Markup". Seeded from the user's Sheet.
 * Slug is unique within its parent sub-pillar.
 */
export const topics = pgTable(
  "topics",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    subPillarId: uuid("sub_pillar_id")
      .notNull()
      .references(() => subPillars.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("topics_sub_pillar_slug_unique").on(table.subPillarId, table.slug),
    index("topics_sub_pillar_id_idx").on(table.subPillarId),
    index("topics_position_idx").on(table.position),
  ],
);

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
