import "server-only";

import {
  bulkUpsertShopifyAppEvents,
  bulkUpsertShopifyShops,
  findShopifyPartnerApp,
  updateShopifyPartnerAppListing,
  updateShopifyPartnerAppSyncStatus,
} from "@kit/database";

import { optimizeListing } from "../ai/app-listing-optimizer";
import { scrapeAppListing } from "../audit/shopify-app-listing";
import { runListingChecks } from "../audit/shopify-listing-checks";
import { decryptSecret } from "./crypto";
import {
  fetchAllAppEvents,
  makePartnerClient,
  type PartnerAppEvent,
} from "./partner-api";

export type SyncResult =
  | {
      ok: true;
      data: {
        eventsFetched: number;
        pages: number;
        shopsTracked: number;
      };
    }
  | {
      ok: false;
      error: { message: string };
    };

const ACTIVE_EVENTS = new Set([
  "RelationshipInstalled",
  "RelationshipReactivated",
]);

const INACTIVE_EVENTS = new Set([
  "RelationshipUninstalled",
  "RelationshipDeactivated",
]);

/**
 * Pull all install/uninstall events for an app, upsert into
 * `shopify_app_events`, then recompute the derived per-shop state in
 * `shopify_shops`. Writes `lastSyncedAt` / `lastSyncError` on the app
 * row so the UI can render a status badge.
 */
export async function syncShopifyApp(
  userId: string,
  appGid: string,
): Promise<SyncResult> {
  const app = await findShopifyPartnerApp(userId, appGid);
  if (!app) {
    return failAndPersist(userId, appGid, {
      message: "App not found on this account.",
    });
  }
  if (!app.organizationId || !app.accessTokenEncrypted) {
    return failAndPersist(userId, appGid, {
      message: "App is missing Partner credentials (org ID or access token). Remove and re-add it.",
    });
  }

  let accessToken: string;
  try {
    accessToken = decryptSecret(app.accessTokenEncrypted);
  } catch (err) {
    return failAndPersist(userId, appGid, {
      message:
        "Couldn't decrypt the saved access token. Remove and re-add the app: " +
        (err instanceof Error ? err.message : "unknown error"),
    });
  }

  const client = makePartnerClient({
    organizationId: app.organizationId,
    accessToken,
  });

  const events = await fetchAllAppEvents(client, { appGid, maxPages: 100 });
  if (!events.ok) {
    return failAndPersist(userId, appGid, {
      message: friendlyApiError(events.error),
    });
  }

  // Upsert raw events (idempotent on the composite PK).
  await bulkUpsertShopifyAppEvents(
    events.data.events.map((e) => ({
      appGid,
      eventType: e.type,
      shopGid: e.shopGid,
      shopName: e.shopName,
      shopDomain: e.shopDomain,
      occurredAt: new Date(e.occurredAt),
      chargeAmount: e.chargeAmount,
      chargeCurrency: e.chargeCurrency,
      chargeName: e.chargeName,
      isTest: e.isTest,
    })),
  );

  // Compute per-shop derived state from the freshly fetched events.
  const shopRows = computeShopStates(appGid, events.data.events);
  await bulkUpsertShopifyShops(shopRows);

  await updateShopifyPartnerAppSyncStatus({
    userId,
    appGid,
    lastSyncedAt: new Date(),
    lastSyncError: null,
  });

  // Backfill App Store URL if missing — try slug candidates until one works.
  let storeUrl = app.appStoreUrl;
  if (!storeUrl) {
    storeUrl = await resolveAppStoreUrl(app.appName);
    if (storeUrl) {
      await updateShopifyPartnerAppListing({ userId, appGid, appStoreUrl: storeUrl });
    }
  }

  // Also sync listing audit — best-effort, doesn't block the sync result.
  if (storeUrl) {
    syncListing(userId, appGid, storeUrl).catch((err) => {
      console.error("[syncShopifyApp] listing sync failed", err);
    });
  }

  return {
    ok: true,
    data: {
      eventsFetched: events.data.events.length,
      pages: events.data.pages,
      shopsTracked: shopRows.length,
    },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * For each unique shopGid, find the latest event and decide
 * active/inactive. First-installed-at is the earliest Installed event
 * we've ever seen for that shop.
 */
function computeShopStates(
  appGid: string,
  events: PartnerAppEvent[],
): Array<{
  appGid: string;
  shopGid: string;
  shopName: string | null;
  shopDomain: string | null;
  currentState: string;
  firstInstalledAt: Date | null;
  lastEventAt: Date;
  email: string | null;
  ownerName: string | null;
}> {
  type Bucket = {
    shopGid: string;
    shopName: string | null;
    shopDomain: string | null;
    latestType: string;
    latestAt: Date;
    firstInstalledAt: Date | null;
    email: string | null;
    ownerName: string | null;
  };
  const byShop = new Map<string, Bucket>();

  for (const evt of events) {
    const at = new Date(evt.occurredAt);
    const existing = byShop.get(evt.shopGid);
    const isInstall = evt.type === "RelationshipInstalled";

    if (!existing) {
      byShop.set(evt.shopGid, {
        shopGid: evt.shopGid,
        shopName: evt.shopName,
        shopDomain: evt.shopDomain,
        latestType: evt.type,
        latestAt: at,
        firstInstalledAt: isInstall ? at : null,
        email: evt.shopEmail,
        ownerName: evt.shopOwner,
      });
      continue;
    }

    if (at > existing.latestAt) {
      existing.latestType = evt.type;
      existing.latestAt = at;
      existing.shopName = evt.shopName ?? existing.shopName;
      existing.shopDomain = evt.shopDomain ?? existing.shopDomain;
    }
    // Keep the latest non-null email/owner (API may not always return them).
    if (evt.shopEmail) existing.email = evt.shopEmail;
    if (evt.shopOwner) existing.ownerName = evt.shopOwner;
    if (isInstall) {
      if (!existing.firstInstalledAt || at < existing.firstInstalledAt) {
        existing.firstInstalledAt = at;
      }
    }
  }

  return [...byShop.values()].map((b) => ({
    appGid,
    shopGid: b.shopGid,
    shopName: b.shopName,
    shopDomain: b.shopDomain,
    currentState: ACTIVE_EVENTS.has(b.latestType)
      ? "active"
      : INACTIVE_EVENTS.has(b.latestType)
        ? "inactive"
        : "unknown",
    firstInstalledAt: b.firstInstalledAt,
    lastEventAt: b.latestAt,
    email: b.email,
    ownerName: b.ownerName,
  }));
}

async function failAndPersist(
  userId: string,
  appGid: string,
  error: { message: string },
): Promise<SyncResult> {
  await updateShopifyPartnerAppSyncStatus({
    userId,
    appGid,
    lastSyncedAt: null,
    lastSyncError: error.message,
  });
  return { ok: false, error };
}

function friendlyApiError(
  error:
    | import("./partner-api").PartnerApiError
    | { kind: "not_found" },
): string {
  switch (error.kind) {
    case "not_found":
      return "Shopify Partner API couldn't find that app GID. Double-check the ID matches an app in your Partner Dashboard.";
    case "http_error":
      if (error.status === 401)
        return "Partner access token rejected (401). Re-save credentials in Settings — the token may be revoked or wrong.";
      if (error.status === 403)
        return "Partner access token is missing the `Manage apps` permission. Edit the API client in Partner Dashboard → Settings → Partner API clients.";
      if (error.status === 429)
        return "Hit Partner API rate limit (429). Wait a minute and retry.";
      return `Partner API returned HTTP ${error.status}: ${error.message}`;
    case "graphql_error":
      return `Partner API rejected the query: ${error.messages.join(" · ")}`;
    case "network":
      return `Network error: ${error.message}`;
    case "timeout":
      return "Partner API timed out after 30s.";
  }
}

// ─── App Store URL resolution ───────────────────────────────────────

/**
 * Try to find the correct App Store URL by testing slug variations.
 * Shopify developers choose their own slug, so it rarely matches a
 * simple slugify of the app name. We try common patterns, then fall
 * back to null (user can paste the URL manually).
 */
async function resolveAppStoreUrl(appName: string): Promise<string | null> {
  const { default: slugify } = await import("@sindresorhus/slugify");

  const base = slugify(appName);
  const words = base.split("-");

  // Build candidate slugs — most likely first
  const candidates = new Set<string>();
  candidates.add(base);                                  // full: "go-fitment-year-make-model"
  if (words.length > 2) candidates.add(words.slice(0, 2).join("-")); // first 2: "go-fitment"
  if (words.length > 3) candidates.add(words.slice(0, 3).join("-")); // first 3: "go-fitment-year"
  candidates.add(words.join(""));                         // no dashes: "gofitmentyearmakemodel"
  if (words.length > 1) candidates.add(words[0]!);       // just first word: "go"

  for (const slug of candidates) {
    const url = `https://apps.shopify.com/${slug}`;
    const ok = await urlExists(url);
    if (ok) return url;
  }

  return null;
}

async function urlExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      redirect: "follow",
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Listing sync ───────────────────────────────────────────────────

async function syncListing(
  userId: string,
  appGid: string,
  appStoreUrl: string,
): Promise<void> {
  const scrapeResult = await scrapeAppListing(appStoreUrl);
  if (!scrapeResult.ok) return;

  const started = Date.now();
  const pulse = runListingChecks(scrapeResult.data);
  const optResult = await optimizeListing(scrapeResult.data).catch(() => null);

  const cachePayload = {
    listing: scrapeResult.data,
    pulse,
    optimization: optResult?.ok ? optResult.data : null,
    optimizationError:
      optResult === null
        ? "LLM failed."
        : optResult.ok
          ? null
          : optResult.error.message,
    modelUsed: optResult?.ok ? optResult.meta.modelUsed : null,
    durationMs: Date.now() - started,
  };

  await updateShopifyPartnerAppListing({
    userId,
    appGid,
    listingCache: cachePayload,
  });
}
