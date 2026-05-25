import {
  boolean,
  index,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Raw install / uninstall / reactivate / deactivate events pulled from
 * the Shopify Partner API's `App.events` field. We store them verbatim
 * so we can recompute per-shop state and run any time-series analytics
 * later without re-fetching.
 *
 * Composite PK on (appGid, eventType, shopGid, occurredAt) makes
 * re-syncs idempotent — if Shopify returns the same event again, the
 * upsert is a no-op.
 *
 * Why no userId FK: appGid is owned by ONE Partner org, which is owned
 * by ONE user in our model. Joining through shopify_partner_apps gives
 * us the user when needed.
 */
export const shopifyAppEvents = pgTable(
  "shopify_app_events",
  {
    appGid: text("app_gid").notNull(),
    /**
     * One of:
     *   - RelationshipInstalled
     *   - RelationshipUninstalled
     *   - RelationshipReactivated
     *   - RelationshipDeactivated
     */
    eventType: text("event_type").notNull(),
    shopGid: text("shop_gid").notNull(),
    shopName: text("shop_name"),
    shopDomain: text("shop_domain"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    // Billing fields — populated only for charge-related events
    // (SubscriptionChargeAccepted, OneTimeChargeAccepted, UsageChargeApplied, etc.)
    /** Charge amount as decimal string (e.g. "9.99"). Null for non-billing events. */
    chargeAmount: numeric("charge_amount", { precision: 12, scale: 2 }),
    chargeCurrency: text("charge_currency"),
    chargeName: text("charge_name"),
    /** True for dev/test store charges — excluded from revenue calculations. */
    isTest: boolean("is_test").default(false),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({
      columns: [table.appGid, table.eventType, table.shopGid, table.occurredAt],
    }),
    /** Fast per-app sort-by-time for charts + recent feeds. */
    index("shopify_app_events_app_occurred_idx").on(
      table.appGid,
      table.occurredAt,
    ),
  ],
);

export type ShopifyAppEventRow = typeof shopifyAppEvents.$inferSelect;
export type NewShopifyAppEventRow = typeof shopifyAppEvents.$inferInsert;
