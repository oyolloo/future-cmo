import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./users";

/**
 * A Shopify app the user has connected to track. Each app carries its
 * OWN Partner credentials so apps from different Partner orgs can coexist
 * on the same user account.
 *
 * Composite PK on (userId, appGid) — a user can add multiple apps, but
 * the same app GID twice would be a no-op upsert.
 */
export const shopifyPartnerApps = pgTable(
  "shopify_partner_apps",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Shopify GID, e.g. "gid://partners/App/123456". */
    appGid: text("app_gid").notNull(),
    /** App display name (denormalised — pulled from Partner API at add time). */
    appName: text("app_name").notNull(),
    /** Public API key — useful for users to confirm they added the right app. */
    apiKey: text("api_key"),
    /** Numeric Partner organization ID from Partner Dashboard URL. */
    organizationId: text("organization_id"),
    /** AES-256-GCM encrypted Partner API access token. */
    accessTokenEncrypted: text("access_token_encrypted"),
    /** Shopify App Store URL (e.g. https://apps.shopify.com/table-pilot). Set once. */
    appStoreUrl: text("app_store_url"),
    /** Cached listing audit result (pulse + LLM). Updated on "Sync listing". */
    listingCache: jsonb("listing_cache"),
    /** Last successful sync — null until the user clicks "Sync". */
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    /** Last sync error message — cleared on successful sync. */
    lastSyncError: text("last_sync_error"),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.appGid] }),
    index("shopify_partner_apps_user_id_idx").on(table.userId),
  ],
);

export type ShopifyPartnerAppRow = typeof shopifyPartnerApps.$inferSelect;
export type NewShopifyPartnerAppRow = typeof shopifyPartnerApps.$inferInsert;
