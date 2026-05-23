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

import { pillars } from "./pillars";

/**
 * Mid-level grouping within a Pillar (sheet column C).
 * Slug is unique *within* its parent pillar — e.g. "fundamentals" can have a
 * different "keyword-research" than "seo" without conflict.
 */
export const subPillars = pgTable(
  "sub_pillars",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    pillarId: uuid("pillar_id")
      .notNull()
      .references(() => pillars.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 80 }).notNull(),
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
  (table) => [
    unique("sub_pillars_pillar_slug_unique").on(table.pillarId, table.slug),
    index("sub_pillars_pillar_id_idx").on(table.pillarId),
    index("sub_pillars_position_idx").on(table.position),
  ],
);

export type SubPillar = typeof subPillars.$inferSelect;
export type NewSubPillar = typeof subPillars.$inferInsert;
