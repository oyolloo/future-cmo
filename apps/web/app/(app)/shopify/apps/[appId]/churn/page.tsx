import Link from "next/link";
import { notFound } from "next/navigation";

import {
  findShopifyPartnerApp,
  getShopifyAtRiskStores,
  getShopifyChurnDetails,
} from "@kit/database";

import { cn } from "@kit/ui/lib/utils";

import { requireUser } from "@/lib/auth/session";

export const metadata = {
  title: "Churn Analysis · future-cmo",
};

export default async function ChurnAnalysisPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const user = await requireUser();
  const { appId: encoded } = await params;
  const appGid = decodeURIComponent(encoded);

  const app = await findShopifyPartnerApp(user.id, appGid);
  if (!app) notFound();

  const [churnDetails, atRiskStores] = await Promise.all([
    getShopifyChurnDetails(appGid).catch(() => []),
    getShopifyAtRiskStores(appGid).catch(() => []),
  ]);

  // Filter out test stores for meaningful analysis.
  const realChurn = churnDetails.filter(
    (c) => c.lastPlan !== "(test store)",
  );
  const testChurn = churnDetails.filter(
    (c) => c.lastPlan === "(test store)",
  );

  // Time-to-churn buckets.
  const buckets = {
    sameDay: realChurn.filter((c) => c.lifetimeDays < 1),
    within7d: realChurn.filter(
      (c) => c.lifetimeDays >= 1 && c.lifetimeDays < 7,
    ),
    within30d: realChurn.filter(
      (c) => c.lifetimeDays >= 7 && c.lifetimeDays < 30,
    ),
    after30d: realChurn.filter((c) => c.lifetimeDays >= 30),
  };

  // By plan.
  const byPlan = new Map<string, number>();
  for (const c of realChurn) {
    const plan = c.lastPlan ?? "Free / no plan";
    byPlan.set(plan, (byPlan.get(plan) ?? 0) + 1);
  }

  // By country.
  const byCountry = new Map<string, number>();
  for (const c of realChurn) {
    const country = c.country ?? "Unknown";
    byCountry.set(country, (byCountry.get(country) ?? 0) + 1);
  }

  const avgLifetime =
    realChurn.length > 0
      ? (
          realChurn.reduce((sum, c) => sum + c.lifetimeDays, 0) /
          realChurn.length
        ).toFixed(1)
      : "—";

  const medianLifetime =
    realChurn.length > 0
      ? (() => {
          const sorted = [...realChurn]
            .map((c) => c.lifetimeDays)
            .sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2
            ? sorted[mid]
            : ((sorted[mid - 1]! + sorted[mid]!) / 2).toFixed(0);
        })()
      : "—";

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <Link
        href={`/shopify/apps/${encodeURIComponent(appGid)}`}
        className="text-comment hover:text-foreground"
      >
        ← back to {app.appName}
      </Link>

      <header className="mt-6">
        <p className="text-label">
          — shopify · {app.appName} · churn analysis
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Churn Analysis
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Understand why and when merchants leave — segmented by time, plan,
          and country.
        </p>
      </header>

      {/* Stats */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total churn events" value={realChurn.length} hint="real merchants (excl. test stores)" />
        <Stat label="Test store churn" value={testChurn.length} hint="dev stores — excluded from analysis" />
        <Stat label="Avg lifetime" value={`${avgLifetime}d`} hint="mean days install → uninstall" />
        <Stat label="Median lifetime" value={`${medianLifetime}d`} hint="50th percentile" />
      </section>

      {/* Time-to-churn breakdown */}
      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <p className="text-label">Time-to-churn breakdown</p>
        <p className="text-comment mt-1">
          {"// when do merchants leave? identify onboarding vs value vs pricing problems"}
        </p>
        <div className="mt-4 flex divide-x divide-border">
          <ChurnBucket
            label="Same day"
            count={buckets.sameDay.length}
            total={realChurn.length}
            diagnosis="Onboarding failure — never got set up"
            tone="fail"
          />
          <ChurnBucket
            label="1–7 days"
            count={buckets.within7d.length}
            total={realChurn.length}
            diagnosis="Value gap — tried but didn't see ROI"
            tone="warn"
          />
          <ChurnBucket
            label="7–30 days"
            count={buckets.within30d.length}
            total={realChurn.length}
            diagnosis="Pricing/competition — found alternative"
            tone="warn"
          />
          <ChurnBucket
            label="30+ days"
            count={buckets.after30d.length}
            total={realChurn.length}
            diagnosis="Natural lifecycle — needs evolved over time"
            tone="ok"
          />
        </div>
      </section>

      {/* By plan + by country side by side */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-label">
            Churn by plan · {byPlan.size} tiers
          </p>
          {byPlan.size === 0 ? (
            <p className="text-comment mt-3">{"// no plan data — sync charges first"}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {[...byPlan.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([plan, count]) => (
                  <li
                    key={plan}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span className="text-sm text-foreground">{plan}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {count} ({realChurn.length > 0 ? Math.round((count / realChurn.length) * 100) : 0}%)
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-label">
            Churn by country · {byCountry.size}
          </p>
          {byCountry.size === 0 ? (
            <p className="text-comment mt-3">{"// add country data to stores CRM"}</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {[...byCountry.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([country, count]) => (
                  <li
                    key={country}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span className="text-sm text-foreground">{country}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {count}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </section>

      {/* At-risk stores */}
      <section className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-5">
        <p className="text-label flex items-center gap-2 text-destructive">
          ▲ At-risk stores · {atRiskStores.length}
        </p>
        <p className="text-comment mt-1">
          {"// active > 3 days, never paid — likely to churn soon. Reach out now."}
        </p>
        {atRiskStores.length === 0 ? (
          <p className="text-comment mt-3">
            {"// no at-risk stores right now — all active stores are paying or very new"}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {atRiskStores.slice(0, 20).map((s) => (
              <li
                key={s.shopGid}
                className="flex flex-wrap items-center justify-between gap-2 py-2"
              >
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">
                    {s.shopName ?? "(unnamed)"}
                  </span>
                  {s.shopDomain ? (
                    <span className="ml-2 font-mono text-[0.6875rem] text-muted-foreground">
                      {s.shopDomain}
                    </span>
                  ) : null}
                </div>
                <span className="font-mono text-[0.625rem] text-muted-foreground">
                  installed{" "}
                  {s.firstInstalledAt
                    ? `${Math.floor((Date.now() - s.firstInstalledAt.getTime()) / (1000 * 60 * 60 * 24))}d ago`
                    : "unknown"}
                </span>
              </li>
            ))}
            {atRiskStores.length > 20 ? (
              <li className="py-2 text-comment">
                {`// + ${atRiskStores.length - 20} more`}
              </li>
            ) : null}
          </ul>
        )}
      </section>

      {/* Recent churns */}
      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <p className="text-label">
          Recent churn events · last 15
        </p>
        {realChurn.length === 0 ? (
          <p className="text-comment mt-3">{"// no churn events (real merchants)"}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {[...realChurn]
              .sort(
                (a, b) =>
                  b.uninstalledAt.getTime() - a.uninstalledAt.getTime(),
              )
              .slice(0, 15)
              .map((c, i) => (
                <li
                  key={`${c.shopGid}-${i}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <div className="min-w-0">
                    <span className="text-sm text-foreground">
                      {c.shopName ?? c.shopDomain ?? "(unnamed)"}
                    </span>
                    <span className="ml-2 font-mono text-[0.625rem] text-muted-foreground">
                      {c.lifetimeDays}d lifetime
                    </span>
                    {c.lastPlan ? (
                      <span className="ml-2 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[0.575rem] uppercase tracking-wider text-muted-foreground">
                        {c.lastPlan}
                      </span>
                    ) : null}
                  </div>
                  <span className="font-mono text-[0.625rem] text-muted-foreground">
                    {c.uninstalledAt.toISOString().slice(0, 10)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─── Components ─────────────────────────────────────────────────────

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-label">{label}</p>
      <p className="mt-1.5 font-mono text-base font-semibold text-foreground">
        {value}
      </p>
      <p className="text-comment mt-1">{`// ${hint}`}</p>
    </div>
  );
}

function ChurnBucket({
  label,
  count,
  total,
  diagnosis,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  diagnosis: string;
  tone: "ok" | "warn" | "fail";
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = {
    ok: "text-[oklch(0.80_0.14_160)]",
    warn: "text-[oklch(0.85_0.14_90)]",
    fail: "text-destructive",
  }[tone];

  return (
    <div className="flex-1 px-4 py-1 text-center">
      <p className="text-label">{label}</p>
      <p className={cn("mt-1 font-mono text-base font-semibold", color)}>
        {count} <span className="text-xs font-normal text-muted-foreground">({pct}%)</span>
      </p>
      <p className="mt-0.5 text-[0.6rem] leading-relaxed text-muted-foreground">
        {diagnosis}
      </p>
    </div>
  );
}
