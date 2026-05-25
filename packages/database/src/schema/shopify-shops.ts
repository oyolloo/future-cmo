import {
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Derived per-shop state cache. Recomputed after each sync from
 * `shopify_app_events`. Lets the analytics page list "active installs"
 * without scanning the event log every time.
 *
 *   - currentState: "active" when the latest event is Installed /
 *     Reactivated; "inactive" otherwise.
 *   - firstInstalledAt: earliest RelationshipInstalled timestamp seen.
 *   - lastEventAt: timestamp of the most recent event in any direction.
 */
export const shopifyShops = pgTable(
  "shopify_shops",
  {
    appGid: text("app_gid").notNull(),
    shopGid: text("shop_gid").notNull(),
    shopName: text("shop_name"),
    shopDomain: text("shop_domain"),
    currentState: text("current_state").notNull(), // "active" | "inactive"
    firstInstalledAt: timestamp("first_installed_at", { withTimezone: true }),
    lastEventAt: timestamp("last_event_at", { withTimezone: true }).notNull(),
    // CRM fields — manually entered by the user for outreach.
    email: text("email"),
    ownerName: text("owner_name"),
    phone: text("phone"),
    notes: text("notes"),
    country: text("country"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.appGid, table.shopGid] }),
    index("shopify_shops_app_state_idx").on(
      table.appGid,
      table.currentState,
    ),
  ],
);

export type ShopifyShopRow = typeof shopifyShops.$inferSelect;
export type NewShopifyShopRow = typeof shopifyShops.$inferInsert;
