import "server-only";

import { and, asc, count, desc, eq, gte, lte, sql } from "drizzle-orm";

import { db } from "../client";
import {
  shopifyAppEvents,
  type NewShopifyAppEventRow,
  type ShopifyAppEventRow,
} from "../schema/shopify-app-events";
import {
  shopifyPartnerApps,
  type NewShopifyPartnerAppRow,
  type ShopifyPartnerAppRow,
} from "../schema/shopify-partner-apps";
import {
  shopifyPartnerCredentials,
  type NewShopifyPartnerCredentialsRow,
  type ShopifyPartnerCredentialsRow,
} from "../schema/shopify-partner-credentials";
import {
  shopifyShops,
  type NewShopifyShopRow,
  type ShopifyShopRow,
} from "../schema/shopify-shops";
import {
  shopifyAppEmailConfig,
  type ShopifyAppEmailConfigRow,
} from "../schema/shopify-app-email-config";

// ─── Credentials ────────────────────────────────────────────────────

export async function findShopifyPartnerCredentials(
  userId: string,
): Promise<ShopifyPartnerCredentialsRow | null> {
  const rows = await db
    .select()
    .from(shopifyPartnerCredentials)
    .where(eq(shopifyPartnerCredentials.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertShopifyPartnerCredentials(
  input: NewShopifyPartnerCredentialsRow,
): Promise<void> {
  await db
    .insert(shopifyPartnerCredentials)
    .values(input)
    .onConflictDoUpdate({
      target: shopifyPartnerCredentials.userId,
      set: {
        organizationId: input.organizationId,
        accessTokenEncrypted: input.accessTokenEncrypted,
        updatedAt: new Date(),
      },
    });
}

export async function deleteShopifyPartnerCredentials(
  userId: string,
): Promise<void> {
  await db
    .delete(shopifyPartnerCredentials)
    .where(eq(shopifyPartnerCredentials.userId, userId));
}

// ─── Apps ────────────────────────────────────────────────────────────

export async function listShopifyPartnerApps(
  userId: string,
): Promise<ShopifyPartnerAppRow[]> {
  return db
    .select()
    .from(shopifyPartnerApps)
    .where(eq(shopifyPartnerApps.userId, userId))
    .orderBy(asc(shopifyPartnerApps.appName));
}

export async function findShopifyPartnerApp(
  userId: string,
  appGid: string,
): Promise<ShopifyPartnerAppRow | null> {
  const rows = await db
    .select()
    .from(shopifyPartnerApps)
    .where(
      and(
        eq(shopifyPartnerApps.userId, userId),
        eq(shopifyPartnerApps.appGid, appGid),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertShopifyPartnerApp(
  input: NewShopifyPartnerAppRow,
): Promise<void> {
  await db
    .insert(shopifyPartnerApps)
    .values(input)
    .onConflictDoUpdate({
      target: [shopifyPartnerApps.userId, shopifyPartnerApps.appGid],
      set: {
        appName: input.appName,
        apiKey: input.apiKey ?? null,
        organizationId: input.organizationId ?? null,
        accessTokenEncrypted: input.accessTokenEncrypted ?? null,
      },
    });
}

export async function updateShopifyPartnerAppListing(input: {
  userId: string;
  appGid: string;
  appStoreUrl?: string;
  listingCache?: unknown;
}): Promise<void> {
  await db
    .update(shopifyPartnerApps)
    .set({
      ...(input.appStoreUrl !== undefined
        ? { appStoreUrl: input.appStoreUrl }
        : {}),
      ...(input.listingCache !== undefined
        ? { listingCache: input.listingCache }
        : {}),
    })
    .where(
      and(
        eq(shopifyPartnerApps.userId, input.userId),
        eq(shopifyPartnerApps.appGid, input.appGid),
      ),
    );
}

export async function updateShopifyPartnerAppSyncStatus(input: {
  userId: string;
  appGid: string;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
}): Promise<void> {
  await db
    .update(shopifyPartnerApps)
    .set({
      lastSyncedAt: input.lastSyncedAt,
      lastSyncError: input.lastSyncError,
    })
    .where(
      and(
        eq(shopifyPartnerApps.userId, input.userId),
        eq(shopifyPartnerApps.appGid, input.appGid),
      ),
    );
}

export async function deleteShopifyPartnerApp(
  userId: string,
  appGid: string,
): Promise<void> {
  // Cascade: drop events + shops too — they're meaningless without the
  // app row.
  await db
    .delete(shopifyAppEvents)
    .where(eq(shopifyAppEvents.appGid, appGid));
  await db.delete(shopifyShops).where(eq(shopifyShops.appGid, appGid));
  await db
    .delete(shopifyPartnerApps)
    .where(
      and(
        eq(shopifyPartnerApps.userId, userId),
        eq(shopifyPartnerApps.appGid, appGid),
      ),
    );
}

// ─── Events ─────────────────────────────────────────────────────────

/**
 * Bulk upsert events from a sync. The composite PK on
 * (appGid, eventType, shopGid, occurredAt) makes duplicates a no-op,
 * so re-running a sync is safe.
 */
export async function bulkUpsertShopifyAppEvents(
  events: NewShopifyAppEventRow[],
): Promise<void> {
  if (events.length === 0) return;
  // Chunk to avoid hitting Postgres parameter limits (max ~65 K
  // parameters per query; 5 cols × 13 K events fits well).
  const CHUNK = 1_000;
  for (let i = 0; i < events.length; i += CHUNK) {
    const slice = events.slice(i, i + CHUNK);
    await db
      .insert(shopifyAppEvents)
      .values(slice)
      .onConflictDoNothing({
        target: [
          shopifyAppEvents.appGid,
          shopifyAppEvents.eventType,
          shopifyAppEvents.shopGid,
          shopifyAppEvents.occurredAt,
        ],
      });
  }
}

export async function listShopifyAppEvents(
  appGid: string,
  options: { since?: Date; limit?: number } = {},
): Promise<ShopifyAppEventRow[]> {
  const conds = [eq(shopifyAppEvents.appGid, appGid)];
  if (options.since) conds.push(gte(shopifyAppEvents.occurredAt, options.since));
  return db
    .select()
    .from(shopifyAppEvents)
    .where(and(...conds))
    .orderBy(desc(shopifyAppEvents.occurredAt))
    .limit(options.limit ?? 1000);
}

/**
 * Daily install + uninstall counts for charts. Returns one row per day
 * (in UTC) within the [since, until] window.
 */
export async function getShopifyAppEventDailyCounts(
  appGid: string,
  since: Date,
  until: Date,
): Promise<
  Array<{
    day: string; // YYYY-MM-DD
    installs: number;
    uninstalls: number;
  }>
> {
  const rows = await db
    .select({
      day: sql<string>`to_char(${shopifyAppEvents.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      installs: sql<number>`count(*) filter (where ${shopifyAppEvents.eventType} = 'RelationshipInstalled')`,
      uninstalls: sql<number>`count(*) filter (where ${shopifyAppEvents.eventType} = 'RelationshipUninstalled')`,
    })
    .from(shopifyAppEvents)
    .where(
      and(
        eq(shopifyAppEvents.appGid, appGid),
        gte(shopifyAppEvents.occurredAt, since),
        lte(shopifyAppEvents.occurredAt, until),
      ),
    )
    .groupBy(
      sql`to_char(${shopifyAppEvents.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
    )
    .orderBy(
      asc(
        sql`to_char(${shopifyAppEvents.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      ),
    );
  return rows.map((r) => ({
    day: r.day,
    installs: Number(r.installs),
    uninstalls: Number(r.uninstalls),
  }));
}

export async function getShopifyAppTotalCounts(appGid: string): Promise<{
  installs: number;
  uninstalls: number;
}> {
  const rows = await db
    .select({
      installs: sql<number>`count(*) filter (where ${shopifyAppEvents.eventType} = 'RelationshipInstalled')`,
      uninstalls: sql<number>`count(*) filter (where ${shopifyAppEvents.eventType} = 'RelationshipUninstalled')`,
    })
    .from(shopifyAppEvents)
    .where(eq(shopifyAppEvents.appGid, appGid));
  const row = rows[0];
  return {
    installs: Number(row?.installs ?? 0),
    uninstalls: Number(row?.uninstalls ?? 0),
  };
}

// ─── Shops ──────────────────────────────────────────────────────────

export async function listShopifyShops(
  appGid: string,
  options: { state?: "active" | "inactive" } = {},
): Promise<ShopifyShopRow[]> {
  const conds = [eq(shopifyShops.appGid, appGid)];
  if (options.state)
    conds.push(eq(shopifyShops.currentState, options.state));
  return db
    .select()
    .from(shopifyShops)
    .where(and(...conds))
    .orderBy(desc(shopifyShops.lastEventAt));
}

export async function countShopifyActiveShops(appGid: string): Promise<number> {
  const rows = await db
    .select({ c: count() })
    .from(shopifyShops)
    .where(
      and(
        eq(shopifyShops.appGid, appGid),
        eq(shopifyShops.currentState, "active"),
      ),
    );
  return Number(rows[0]?.c ?? 0);
}

export async function bulkUpsertShopifyShops(
  rows: NewShopifyShopRow[],
): Promise<void> {
  if (rows.length === 0) return;
  const CHUNK = 1_000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    await db
      .insert(shopifyShops)
      .values(slice)
      .onConflictDoUpdate({
        target: [shopifyShops.appGid, shopifyShops.shopGid],
        set: {
          shopName: sql`excluded.shop_name`,
          shopDomain: sql`excluded.shop_domain`,
          currentState: sql`excluded.current_state`,
          firstInstalledAt: sql`excluded.first_installed_at`,
          lastEventAt: sql`excluded.last_event_at`,
          // Only overwrite email/ownerName when the API actually returned
          // a value — preserve manually-entered CRM data otherwise.
          email: sql`coalesce(excluded.email, ${shopifyShops.email})`,
          ownerName: sql`coalesce(excluded.owner_name, ${shopifyShops.ownerName})`,
          updatedAt: new Date(),
        },
      });
  }
}

// ─── CRM ────────────────────────────────────────────────────────────

export async function updateShopifyShopCrm(input: {
  appGid: string;
  shopGid: string;
  email?: string | null;
  ownerName?: string | null;
  phone?: string | null;
  notes?: string | null;
  country?: string | null;
}): Promise<void> {
  await db
    .update(shopifyShops)
    .set({
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.ownerName !== undefined ? { ownerName: input.ownerName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(shopifyShops.appGid, input.appGid),
        eq(shopifyShops.shopGid, input.shopGid),
      ),
    );
}

// ─── Retention ──────────────────────────────────────────────────────

/**
 * Compute retention bands. For each first-install, check if the shop is
 * still active N days later. Returns counts per band.
 */
export async function getShopifyRetentionBands(appGid: string): Promise<{
  total: number;
  day7: { retained: number; eligible: number };
  day30: { retained: number; eligible: number };
  day90: { retained: number; eligible: number };
}> {
  const shops = await db
    .select({
      firstInstalledAt: shopifyShops.firstInstalledAt,
      currentState: shopifyShops.currentState,
    })
    .from(shopifyShops)
    .where(eq(shopifyShops.appGid, appGid));

  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  let total = 0;
  const bands = { 7: { eligible: 0, retained: 0 }, 30: { eligible: 0, retained: 0 }, 90: { eligible: 0, retained: 0 } };

  for (const shop of shops) {
    if (!shop.firstInstalledAt) continue;
    total++;
    const ageMs = now - shop.firstInstalledAt.getTime();
    const isActive = shop.currentState === "active";

    for (const d of [7, 30, 90] as const) {
      if (ageMs >= d * day) {
        bands[d].eligible++;
        if (isActive) bands[d].retained++;
      }
    }
  }

  return {
    total,
    day7: bands[7],
    day30: bands[30],
    day90: bands[90],
  };
}

// ─── Activity feed ──────────────────────────────────────────────────

export async function getShopifyRecentActivity(
  appGid: string,
  limit = 20,
): Promise<ShopifyAppEventRow[]> {
  return db
    .select()
    .from(shopifyAppEvents)
    .where(eq(shopifyAppEvents.appGid, appGid))
    .orderBy(desc(shopifyAppEvents.occurredAt))
    .limit(limit);
}

// ─── Revenue ────────────────────────────────────────────────────────

/** Billing event types that represent positive revenue. */
const REVENUE_EVENTS = [
  "SubscriptionChargeAccepted",
  "SubscriptionChargeActivated",
  "OneTimeChargeAccepted",
  "OneTimeChargeActivated",
  "UsageChargeApplied",
] as const;

/**
 * Total lifetime revenue (excluding test charges).
 */
export async function getShopifyAppTotalRevenue(appGid: string): Promise<{
  totalRevenue: number;
  currency: string | null;
}> {
  const rows = await db
    .select({
      total: sql<string>`coalesce(sum(${shopifyAppEvents.chargeAmount}::numeric), 0)`,
      currency: sql<string>`max(${shopifyAppEvents.chargeCurrency})`,
    })
    .from(shopifyAppEvents)
    .where(
      and(
        eq(shopifyAppEvents.appGid, appGid),
        sql`${shopifyAppEvents.eventType} in (${sql.join(
          REVENUE_EVENTS.map((e) => sql`${e}`),
          sql`, `,
        )})`,
        sql`${shopifyAppEvents.chargeAmount} is not null`,
        sql`(${shopifyAppEvents.isTest} = false or ${shopifyAppEvents.isTest} is null)`,
      ),
    );
  const row = rows[0];
  return {
    totalRevenue: Number.parseFloat(row?.total ?? "0") || 0,
    currency: row?.currency ?? null,
  };
}

/**
 * Current MRR — sum of the latest active subscription charges per shop.
 * We find each shop's most recent SubscriptionChargeAccepted/Activated
 * event and sum those amounts. Only includes shops that are currently
 * "active" in the shops table.
 */
export async function getShopifyAppMRR(appGid: string): Promise<{
  mrr: number;
  currency: string | null;
  payingStores: number;
}> {
  // Get all active shops
  const activeShops = await db
    .select({ shopGid: shopifyShops.shopGid })
    .from(shopifyShops)
    .where(
      and(
        eq(shopifyShops.appGid, appGid),
        eq(shopifyShops.currentState, "active"),
      ),
    );

  if (activeShops.length === 0) {
    return { mrr: 0, currency: null, payingStores: 0 };
  }

  // For each active shop, find their latest subscription charge
  const shopGids = activeShops.map((s) => s.shopGid);
  const subEvents = await db
    .select({
      shopGid: shopifyAppEvents.shopGid,
      amount: shopifyAppEvents.chargeAmount,
      currency: shopifyAppEvents.chargeCurrency,
      occurredAt: shopifyAppEvents.occurredAt,
    })
    .from(shopifyAppEvents)
    .where(
      and(
        eq(shopifyAppEvents.appGid, appGid),
        sql`${shopifyAppEvents.eventType} in ('SubscriptionChargeAccepted', 'SubscriptionChargeActivated')`,
        sql`${shopifyAppEvents.chargeAmount} is not null`,
        sql`(${shopifyAppEvents.isTest} = false or ${shopifyAppEvents.isTest} is null)`,
      ),
    )
    .orderBy(desc(shopifyAppEvents.occurredAt));

  // Pick latest per active shop
  const seen = new Set<string>();
  let mrr = 0;
  let payingStores = 0;
  let currency: string | null = null;

  for (const evt of subEvents) {
    if (!shopGids.includes(evt.shopGid)) continue;
    if (seen.has(evt.shopGid)) continue;
    seen.add(evt.shopGid);
    const amt = Number.parseFloat(String(evt.amount ?? "0"));
    if (amt > 0) {
      mrr += amt;
      payingStores++;
      if (!currency) currency = evt.currency;
    }
  }

  return { mrr, currency, payingStores };
}

/**
 * Daily revenue for charts — sum of charge amounts per day (UTC),
 * excluding test charges.
 */
export async function getShopifyAppDailyRevenue(
  appGid: string,
  since: Date,
  until: Date,
): Promise<Array<{ day: string; revenue: number }>> {
  const rows = await db
    .select({
      day: sql<string>`to_char(${shopifyAppEvents.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      revenue: sql<string>`coalesce(sum(${shopifyAppEvents.chargeAmount}::numeric), 0)`,
    })
    .from(shopifyAppEvents)
    .where(
      and(
        eq(shopifyAppEvents.appGid, appGid),
        sql`${shopifyAppEvents.eventType} in (${sql.join(
          REVENUE_EVENTS.map((e) => sql`${e}`),
          sql`, `,
        )})`,
        sql`${shopifyAppEvents.chargeAmount} is not null`,
        sql`(${shopifyAppEvents.isTest} = false or ${shopifyAppEvents.isTest} is null)`,
        gte(shopifyAppEvents.occurredAt, since),
        lte(shopifyAppEvents.occurredAt, until),
      ),
    )
    .groupBy(
      sql`to_char(${shopifyAppEvents.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
    )
    .orderBy(
      asc(
        sql`to_char(${shopifyAppEvents.occurredAt} at time zone 'UTC', 'YYYY-MM-DD')`,
      ),
    );
  return rows.map((r) => ({
    day: r.day,
    revenue: Number.parseFloat(r.revenue) || 0,
  }));
}

/**
 * Revenue per store — total revenue generated by each shop (excluding
 * test charges). Used to add a revenue column to the stores CRM table.
 */
export async function getShopifyAppRevenueByStore(
  appGid: string,
): Promise<Map<string, { revenue: number; currency: string | null }>> {
  const rows = await db
    .select({
      shopGid: shopifyAppEvents.shopGid,
      revenue: sql<string>`coalesce(sum(${shopifyAppEvents.chargeAmount}::numeric), 0)`,
      currency: sql<string>`max(${shopifyAppEvents.chargeCurrency})`,
    })
    .from(shopifyAppEvents)
    .where(
      and(
        eq(shopifyAppEvents.appGid, appGid),
        sql`${shopifyAppEvents.eventType} in (${sql.join(
          REVENUE_EVENTS.map((e) => sql`${e}`),
          sql`, `,
        )})`,
        sql`${shopifyAppEvents.chargeAmount} is not null`,
        sql`(${shopifyAppEvents.isTest} = false or ${shopifyAppEvents.isTest} is null)`,
      ),
    )
    .groupBy(shopifyAppEvents.shopGid);

  const map = new Map<string, { revenue: number; currency: string | null }>();
  for (const r of rows) {
    map.set(r.shopGid, {
      revenue: Number.parseFloat(r.revenue) || 0,
      currency: r.currency ?? null,
    });
  }
  return map;
}

// ─── Churn Analysis ─────────────────────────────────────────────────

export type ChurnedShopDetail = {
  shopGid: string;
  shopName: string | null;
  shopDomain: string | null;
  firstInstalledAt: Date | null;
  uninstalledAt: Date;
  /** Days between first install and uninstall. */
  lifetimeDays: number;
  /** Last charge plan name before churn (null if free-only). */
  lastPlan: string | null;
  country: string | null;
};

/**
 * Build detailed churn records by joining install events with uninstall
 * events per shop. Each record = one churn episode (shop installed then
 * later uninstalled). A shop that installed → uninstalled → reinstalled
 * → uninstalled produces TWO churn records.
 */
export async function getShopifyChurnDetails(
  appGid: string,
): Promise<ChurnedShopDetail[]> {
  // Get all events + shops for this app in one shot.
  const [events, shops] = await Promise.all([
    db
      .select()
      .from(shopifyAppEvents)
      .where(eq(shopifyAppEvents.appGid, appGid))
      .orderBy(asc(shopifyAppEvents.occurredAt)),
    db
      .select()
      .from(shopifyShops)
      .where(eq(shopifyShops.appGid, appGid)),
  ]);

  const shopMap = new Map(shops.map((s) => [s.shopGid, s]));

  // Group events by shop, sorted chronologically.
  const byShop = new Map<string, typeof events>();
  for (const evt of events) {
    const list = byShop.get(evt.shopGid);
    if (list) list.push(evt);
    else byShop.set(evt.shopGid, [evt]);
  }

  const churned: ChurnedShopDetail[] = [];

  for (const [shopGid, shopEvents] of byShop) {
    const shop = shopMap.get(shopGid);
    let lastInstallAt: Date | null = null;
    let lastPlan: string | null = null;

    for (const evt of shopEvents) {
      if (
        evt.eventType === "RelationshipInstalled" ||
        evt.eventType === "RelationshipReactivated"
      ) {
        lastInstallAt = evt.occurredAt;
        lastPlan = null; // reset plan tracking for this install session
      } else if (
        evt.eventType === "SubscriptionChargeAccepted" ||
        evt.eventType === "SubscriptionChargeActivated"
      ) {
        if (evt.chargeName) lastPlan = evt.chargeName;
      } else if (
        evt.eventType === "RelationshipUninstalled" ||
        evt.eventType === "RelationshipDeactivated"
      ) {
        const lifetimeMs = lastInstallAt
          ? evt.occurredAt.getTime() - lastInstallAt.getTime()
          : 0;
        churned.push({
          shopGid,
          shopName: evt.shopName ?? shop?.shopName ?? null,
          shopDomain: evt.shopDomain ?? shop?.shopDomain ?? null,
          firstInstalledAt: lastInstallAt,
          uninstalledAt: evt.occurredAt,
          lifetimeDays: Math.max(
            0,
            Math.floor(lifetimeMs / (1000 * 60 * 60 * 24)),
          ),
          lastPlan: lastPlan ?? (evt.isTest ? "(test store)" : null),
          country: shop?.country ?? null,
        });
        lastInstallAt = null;
        lastPlan = null;
      }
    }
  }

  return churned;
}

/**
 * Active stores that match common churn patterns — "at risk" of leaving.
 * Heuristic: active store with no subscription charge event and installed
 * more than 3 days ago. These free riders often churn after the trial.
 */
export async function getShopifyAtRiskStores(
  appGid: string,
): Promise<ShopifyShopRow[]> {
  const [activeShops, chargeEvents] = await Promise.all([
    db
      .select()
      .from(shopifyShops)
      .where(
        and(
          eq(shopifyShops.appGid, appGid),
          eq(shopifyShops.currentState, "active"),
        ),
      ),
    db
      .select({
        shopGid: shopifyAppEvents.shopGid,
      })
      .from(shopifyAppEvents)
      .where(
        and(
          eq(shopifyAppEvents.appGid, appGid),
          sql`${shopifyAppEvents.eventType} in ('SubscriptionChargeAccepted', 'SubscriptionChargeActivated')`,
          sql`(${shopifyAppEvents.isTest} = false or ${shopifyAppEvents.isTest} is null)`,
        ),
      ),
  ]);

  const paidShopGids = new Set(chargeEvents.map((e) => e.shopGid));
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  return activeShops.filter((shop) => {
    if (paidShopGids.has(shop.shopGid)) return false; // has paid — not at risk
    if (!shop.firstInstalledAt) return true; // unknown install date — flag
    return shop.firstInstalledAt < threeDaysAgo; // installed > 3d ago, never paid
  });
}

// ─── Email config ──────────────────────────────────────────────────

export async function findShopifyAppEmailConfig(
  userId: string,
  appGid: string,
): Promise<ShopifyAppEmailConfigRow | null> {
  const rows = await db
    .select()
    .from(shopifyAppEmailConfig)
    .where(
      and(
        eq(shopifyAppEmailConfig.userId, userId),
        eq(shopifyAppEmailConfig.appGid, appGid),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertShopifyAppEmailConfig(input: {
  userId: string;
  appGid: string;
  provider: string;
  apiKeyEncrypted: string;
  fromEmail: string;
  fromName: string;
}): Promise<void> {
  await db
    .insert(shopifyAppEmailConfig)
    .values({
      userId: input.userId,
      appGid: input.appGid,
      provider: input.provider,
      apiKeyEncrypted: input.apiKeyEncrypted,
      fromEmail: input.fromEmail,
      fromName: input.fromName,
    })
    .onConflictDoUpdate({
      target: [shopifyAppEmailConfig.userId, shopifyAppEmailConfig.appGid],
      set: {
        provider: input.provider,
        apiKeyEncrypted: input.apiKeyEncrypted,
        fromEmail: input.fromEmail,
        fromName: input.fromName,
        updatedAt: new Date(),
      },
    });
}

export async function deleteShopifyAppEmailConfig(
  userId: string,
  appGid: string,
): Promise<void> {
  await db
    .delete(shopifyAppEmailConfig)
    .where(
      and(
        eq(shopifyAppEmailConfig.userId, userId),
        eq(shopifyAppEmailConfig.appGid, appGid),
      ),
    );
}
