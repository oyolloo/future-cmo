import {
  countShopifyActiveShops,
  getShopifyAppTotalCounts,
  listShopifyPartnerApps,
} from "@kit/database";

import { requireUser } from "@/lib/auth/session";

import { AddAppButton } from "./_components/add-app-form";
import { AppsTable } from "./_components/apps-table";

export const metadata = {
  title: "Shopify Apps · future-cmo",
};

export default async function ShopifyHubPage() {
  const user = await requireUser();
  const apps = await listShopifyPartnerApps(user.id);

  const appsWithStats = await Promise.all(
    apps.map(async (a) => {
      const [totals, activeCount] = await Promise.all([
        getShopifyAppTotalCounts(a.appGid),
        countShopifyActiveShops(a.appGid),
      ]);
      const cache = a.listingCache as { listing?: { iconUrl?: string } } | null;
      return {
        appGid: a.appGid,
        appName: a.appName,
        apiKey: a.apiKey,
        iconUrl: cache?.listing?.iconUrl ?? null,
        activeInstalls: activeCount,
        totalInstalls: totals.installs,
        totalUninstalls: totals.uninstalls,
        lastSyncedAt: a.lastSyncedAt ? a.lastSyncedAt.toISOString() : null,
        lastSyncError: a.lastSyncError,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-6xl px-8 py-10 space-y-8">
      {/* Row 1: title left · button right */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label">— e-commerce · shopify partner</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Shopify Apps
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track installs, uninstalls, active stores per app, daily trends.
          </p>
        </div>
        <AddAppButton />
      </header>

      {/* Row 2: table full width */}
      <AppsTable apps={appsWithStats} />
    </div>
  );
}
