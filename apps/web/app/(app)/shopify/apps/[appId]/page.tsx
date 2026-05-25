import Link from "next/link";
import { notFound } from "next/navigation";

import {
  countShopifyActiveShops,
  findShopifyAppEmailConfig,
  findShopifyPartnerApp,
  getShopifyAppEventDailyCounts,
  getShopifyAppMRR,
  getShopifyAppRevenueByStore,
  getShopifyAppTotalCounts,
  getShopifyAppTotalRevenue,
  getShopifyRecentActivity,
  getShopifyRetentionBands,
  listShopifyShops,
} from "@kit/database";

import { cn } from "@kit/ui/lib/utils";

import { requireUser } from "@/lib/auth/session";

import { ActivityFeed } from "./_components/activity-feed";
import { ActivityStoresTabs } from "./_components/activity-stores-tabs";
import { InstallChart } from "./_components/install-chart";
import { ListingAuditTab } from "./_components/listing-audit-tab";
import { ListingGallery } from "./_components/listing-gallery";
import { RetentionBands } from "./_components/retention-bands";
import { EmailSettingsTab } from "./_components/email-settings-tab";
import { ScreenshotAnalysisTab } from "./_components/screenshot-analysis-tab";
import { StoresTable } from "./_components/stores-table";
import { SyncButton } from "./_components/sync-button";

export const metadata = {
  title: "Shopify app analytics · future-cmo",
};

const WINDOW_DAYS = 30;

export default async function ShopifyAppDetailPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const user = await requireUser();
  const { appId: encoded } = await params;
  const appGid = decodeURIComponent(encoded);

  const app = await findShopifyPartnerApp(user.id, appGid);
  if (!app) notFound();

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - (WINDOW_DAYS - 1));
  windowStart.setUTCHours(0, 0, 0, 0);

  const [
    totals,
    activeCount,
    dailyCounts,
    shops,
    retention,
    recentEvents,
    totalRevenue,
    mrr,
    revenueByStore,
    emailConfig,
  ] = await Promise.all([
    getShopifyAppTotalCounts(appGid).catch(() => ({ installs: 0, uninstalls: 0 })),
    countShopifyActiveShops(appGid).catch(() => 0),
    getShopifyAppEventDailyCounts(appGid, windowStart, now).catch(() => []),
    listShopifyShops(appGid).catch(() => []),
    getShopifyRetentionBands(appGid).catch(() => ({
      total: 0,
      day7: { retained: 0, eligible: 0 },
      day30: { retained: 0, eligible: 0 },
      day90: { retained: 0, eligible: 0 },
    })),
    getShopifyRecentActivity(appGid, 100).catch(() => []),
    getShopifyAppTotalRevenue(appGid).catch(() => ({
      totalRevenue: 0,
      currency: null,
    })),
    getShopifyAppMRR(appGid).catch(() => ({
      mrr: 0,
      currency: null,
      payingStores: 0,
    })),
    getShopifyAppRevenueByStore(appGid).catch(
      () => new Map<string, { revenue: number; currency: string | null }>(),
    ),
    findShopifyAppEmailConfig(user.id, appGid).catch(() => null),
  ]);

  const cache = app.listingCache as {
    listing?: { screenshots?: string[]; iconUrl?: string | null };
  } | null;
  const screenshots = cache?.listing?.screenshots ?? [];
  const iconUrl = cache?.listing?.iconUrl ?? null;

  const churnRate =
    totals.installs > 0
      ? Math.round((totals.uninstalls / totals.installs) * 100)
      : 0;
  const arpu =
    mrr.payingStores > 0
      ? (mrr.mrr / mrr.payingStores).toFixed(2)
      : "0.00";
  const currency = totalRevenue.currency ?? mrr.currency ?? "USD";

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <Link
        href="/shopify"
        className="text-comment hover:text-foreground"
      >
        ← back to Shopify apps
      </Link>

      <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={app.appName}
              className="size-14 shrink-0 rounded-xl border border-border object-contain"
            />
          ) : null}
          <div className="min-w-0">
            <p className="text-label">
              — shopify · {app.appName} ·{" "}
              <Link
                href={`/shopify/apps/${encodeURIComponent(appGid)}/churn`}
                className="text-primary hover:underline"
              >
                churn analysis →
              </Link>
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {app.appName}
            </h1>
            <p className="mt-2 font-mono text-[0.6875rem] text-muted-foreground">
              {appGid}
              {app.apiKey ? ` · api key ${app.apiKey}` : ""}
            </p>
          </div>
        </div>
        <SyncButton
          appGid={appGid}
          lastSyncedAt={
            app.lastSyncedAt ? app.lastSyncedAt.toISOString() : null
          }
          lastSyncError={app.lastSyncError}
        />
      </header>

      {/* Screenshot gallery */}
      {screenshots.length > 0 ? (
        <section className="mt-8">
          <ListingGallery screenshots={screenshots} appName={app.appName} />
        </section>
      ) : null}

      {/* Revenue stats */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={`${currency} ${totalRevenue.totalRevenue.toFixed(2)}`}
          tone="ok"
          hint="Lifetime (excl. test charges)"
        />
        <StatCard
          label="Current MRR"
          value={`${currency} ${mrr.mrr.toFixed(2)}`}
          tone={mrr.mrr > 0 ? "ok" : "neutral"}
          hint={`${mrr.payingStores} paying stores`}
        />
        <StatCard
          label="ARPU"
          value={`${currency} ${arpu}`}
          tone="neutral"
          hint="MRR ÷ paying stores"
        />
        <StatCard
          label="Churn rate"
          value={`${churnRate}%`}
          tone={churnRate > 30 ? "warn" : "neutral"}
          hint="Uninstalls ÷ installs"
        />
      </section>

      {/* Install stats */}
      <section className="mt-4 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Active installs"
          value={activeCount}
          tone="ok"
          hint="Latest event = install / reactivate"
        />
        <StatCard
          label="Lifetime installs"
          value={totals.installs}
          tone="neutral"
          hint="All-time install events"
        />
        <StatCard
          label="Lifetime uninstalls"
          value={totals.uninstalls}
          tone="neutral"
          hint="All-time uninstall events"
        />
      </section>

      {/* Chart + retention side by side */}
      <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="rounded-lg border border-border bg-card p-6">
          <InstallChart
            data={dailyCounts}
            startDay={windowStart.toISOString().slice(0, 10)}
            endDay={now.toISOString().slice(0, 10)}
          />
        </div>
        <RetentionBands data={retention} />
      </section>

      {/* Tabbed: Stores + Recent Activity */}
      <section className="mt-8">
        <ActivityStoresTabs
          storesCount={shops.length}
          eventsCount={recentEvents.length}
          storesContent={
            <StoresTable
              appGid={appGid}
              appName={app.appName}
              rows={shops.map((s) => {
                const rev = revenueByStore.get(s.shopGid);
                return {
                  appGid: s.appGid,
                  shopGid: s.shopGid,
                  shopName: s.shopName,
                  shopDomain: s.shopDomain,
                  currentState: s.currentState,
                  firstInstalledAt: s.firstInstalledAt
                    ? s.firstInstalledAt.toISOString()
                    : null,
                  lastEventAt: s.lastEventAt.toISOString(),
                  email: s.email,
                  ownerName: s.ownerName,
                  phone: s.phone,
                  notes: s.notes,
                  country: s.country,
                  revenue: rev?.revenue ?? 0,
                  revenueCurrency: rev?.currency ?? currency,
                };
              })}
            />
          }
          activityContent={
            <ActivityFeed
              appGid={appGid}
              appName={app.appName}
              emailConfigured={!!emailConfig}
              events={recentEvents.map((e, i) => {
                const shop = shops.find((s) => s.shopGid === e.shopGid);
                return {
                  id: `${e.eventType}-${e.occurredAt.getTime()}-${i}`,
                  eventType: e.eventType,
                  shopName: e.shopName,
                  shopDomain: e.shopDomain,
                  shopEmail: shop?.email ?? null,
                  ownerName: shop?.ownerName ?? null,
                  occurredAt: e.occurredAt.toISOString(),
                };
              })}
            />
          }
          listingContent={
            <ListingAuditTab
              appGid={appGid}
              appStoreUrl={app.appStoreUrl ?? null}
              listingCache={app.listingCache}
            />
          }
          imageAnalysisContent={
            <ScreenshotAnalysisTab
              screenshots={screenshots}
              appName={app.appName}
            />
          }
          settingsContent={
            <EmailSettingsTab
              appGid={appGid}
              existing={
                emailConfig
                  ? {
                      provider: emailConfig.provider,
                      fromEmail: emailConfig.fromEmail,
                      fromName: emailConfig.fromName,
                    }
                  : null
              }
            />
          }
        />
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number | string;
  hint: string;
  tone: "ok" | "neutral" | "warn";
}) {
  const color = {
    ok: "text-[oklch(0.80_0.14_160)]",
    neutral: "text-foreground",
    warn: "text-[oklch(0.85_0.14_90)]",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-label">{label}</p>
      <p className={cn("mt-1.5 font-mono text-base font-semibold", color)}>
        {value}
      </p>
      <p className="text-comment mt-1">{`// ${hint}`}</p>
    </div>
  );
}
