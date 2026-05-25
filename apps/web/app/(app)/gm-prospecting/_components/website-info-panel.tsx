"use client";

import { useState } from "react";

import { Button } from "@kit/ui/button";
import {
  ChevronDownIcon as ChevronDown,
  GlobeIcon as Globe,
} from "@kit/ui/icons";
import { cn } from "@kit/ui/lib/utils";
import { Skeleton } from "@kit/ui/skeleton";

import type { CachedWebsiteInfo } from "@/lib/website-info/cache";

import {
  cmsDetectAction,
  domainInfoAction,
  screenshotWebsiteAction,
  speedAuditAction,
  type CmsActionState,
  type DomainActionState,
  type ScreenshotActionState,
  type SpeedActionState,
} from "../_lib/website-info-actions";

type AsyncSlot<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; message: string };

type ScreenshotData = NonNullable<
  Extract<ScreenshotActionState, { ok: true }>["data"]
>;
type CmsData = NonNullable<Extract<CmsActionState, { ok: true }>["data"]>;
type SpeedData = NonNullable<Extract<SpeedActionState, { ok: true }>["data"]>;
type DomainData = NonNullable<
  Extract<DomainActionState, { ok: true }>["data"]
>;

type Props = {
  placeId: string;
  websiteUrl: string | null;
  initialCache: CachedWebsiteInfo | null;
};

/**
 * Right-sidebar panel that surfaces screenshot · CMS · speed · domain
 * for the business's website. Two lifecycle states:
 *
 *   1. **Cold** (no cache) — shows just the title + "Request" button.
 *      Click → fires four server actions in parallel. Each card
 *      renders its own skeleton while waiting and slot-by-slot replaces
 *      with real data as each request lands.
 *   2. **Warm** (cache present) — slots are seeded from the cache row
 *      that the server fetched at page render. Renders immediately,
 *      Refresh button replaces Request.
 *
 * Each successful action also writes its slot to `business_website_info_cache`
 * (30-day TTL) so re-opens skip the network entirely.
 */
export function WebsiteInfoPanel({
  placeId,
  websiteUrl,
  initialCache,
}: Props) {
  // Seed each slot from the server-fetched cache row, if present.
  const seeded = initialCache && hasAnyCachedSlot(initialCache);

  const [requested, setRequested] = useState(Boolean(seeded));
  const [screenshot, setScreenshot] = useState<AsyncSlot<ScreenshotData>>(
    initialSlot<ScreenshotData>(initialCache?.screenshot),
  );
  const [cms, setCms] = useState<AsyncSlot<CmsData>>(
    initialSlot<CmsData>(initialCache?.cms),
  );
  const [speed, setSpeed] = useState<AsyncSlot<SpeedData>>(
    initialSlot<SpeedData>(initialCache?.speed),
  );
  const [domain, setDomain] = useState<AsyncSlot<DomainData>>(
    initialSlot<DomainData>(initialCache?.domain),
  );

  // Kick all four off in parallel. Used for both initial Request and
  // subsequent Refresh — Refresh just re-runs everything, fresh results
  // overwrite the existing cache row.
  const runAll = () => {
    if (!websiteUrl) return;
    setRequested(true);

    setScreenshot({ status: "loading" });
    screenshotWebsiteAction(websiteUrl, placeId).then((r) =>
      setScreenshot(
        r.ok
          ? { status: "ok", data: r.data }
          : { status: "error", message: r.error.message },
      ),
    );

    setCms({ status: "loading" });
    cmsDetectAction(websiteUrl, placeId).then((r) =>
      setCms(
        r.ok
          ? { status: "ok", data: r.data }
          : { status: "error", message: r.error.message },
      ),
    );

    setSpeed({ status: "loading" });
    speedAuditAction(websiteUrl, placeId).then((r) =>
      setSpeed(
        r.ok
          ? { status: "ok", data: r.data }
          : { status: "error", message: r.error.message },
      ),
    );

    setDomain({ status: "loading" });
    domainInfoAction(websiteUrl, placeId).then((r) =>
      setDomain(
        r.ok
          ? { status: "ok", data: r.data }
          : { status: "error", message: r.error.message },
      ),
    );
  };

  if (!websiteUrl) {
    return (
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-label">Website information</p>
        <p className="text-comment mt-3">
          {"// no website on file for this business"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-label flex items-center gap-2">
          <Globe className="size-3.5" />
          Website information
        </p>
        {!requested ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={runAll}
          >
            Request
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={runAll}
            title="Re-scan + overwrite cache"
          >
            Refresh
          </Button>
        )}
      </div>

      {!requested ? (
        <p className="text-comment mt-3">
          {"// Click Request to pull screenshot, tech stack, speed scores, and domain info. Cached 30 days."}
        </p>
      ) : (
        <div className="mt-3 divide-y divide-border">
          <ScreenshotCard slot={screenshot} />
          <CmsCard slot={cms} />
          <SpeedCard slot={speed} />
          <DomainCard slot={domain} />
        </div>
      )}
    </div>
  );
}

// ─── Cache hydration helpers ────────────────────────────────────────

function hasAnyCachedSlot(cache: CachedWebsiteInfo): boolean {
  return Boolean(cache.screenshot || cache.cms || cache.speed || cache.domain);
}

/** Map a cache slot (unknown jsonb shape from DB) to an AsyncSlot. Null
 *  values stay "idle" — they were never successfully fetched. */
function initialSlot<T>(value: unknown): AsyncSlot<T> {
  if (value == null) return { status: "idle" };
  return { status: "ok", data: value as T };
}

// ─── Generic card chrome ────────────────────────────────────────────

function InfoCard({
  title,
  status,
  summary,
  expandedContent,
  errorMessage,
  defaultOpen = false,
}: {
  title: string;
  status: AsyncSlot<unknown>["status"];
  summary: React.ReactNode;
  expandedContent: React.ReactNode;
  errorMessage?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const canExpand = status === "ok";

  return (
    <div className="py-3">
      <button
        type="button"
        onClick={() => (canExpand ? setOpen((v) => !v) : null)}
        disabled={!canExpand}
        aria-expanded={open}
        className={cn(
          "-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-2 rounded-md px-2 py-1 text-left",
          canExpand ? "cursor-pointer hover:bg-muted/40" : "cursor-default",
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <div className="mt-1 text-xs text-foreground">{summary}</div>
        </div>
        {canExpand ? (
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
        ) : null}
      </button>

      {status === "error" ? (
        <p className="mt-2 rounded border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-[0.6875rem] text-destructive">
          {errorMessage ?? "Error"}
        </p>
      ) : null}

      {open && canExpand ? (
        <div className="mt-3">{expandedContent}</div>
      ) : null}
    </div>
  );
}

// ─── Screenshot ─────────────────────────────────────────────────────

function ScreenshotCard({
  slot,
}: {
  slot: AsyncSlot<{ dataUri: string; width: number; height: number }>;
}) {
  if (slot.status === "idle" || slot.status === "loading") {
    return (
      <div className="py-3">
        <p className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
          Desktop screenshot
        </p>
        <Skeleton className="mt-2 aspect-video w-full" />
        {slot.status === "loading" ? (
          <p className="text-comment mt-1.5">
            {"// capturing with headless Chromium…"}
          </p>
        ) : null}
      </div>
    );
  }
  if (slot.status === "error") {
    return (
      <InfoCard
        title="Desktop screenshot"
        status="error"
        summary={<span className="text-destructive">Failed</span>}
        expandedContent={null}
        errorMessage={slot.message}
      />
    );
  }
  return (
    <div className="py-3">
      <p className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
        Desktop screenshot
      </p>
      <div className="mt-2 max-h-[280px] overflow-auto rounded border border-border bg-muted/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slot.data.dataUri}
          alt="Website desktop view"
          className="block w-full"
          loading="lazy"
        />
      </div>
    </div>
  );
}

// ─── CMS ────────────────────────────────────────────────────────────

function CmsCard({
  slot,
}: {
  slot: AsyncSlot<NonNullable<Extract<CmsActionState, { ok: true }>["data"]>>;
}) {
  if (slot.status === "idle" || slot.status === "loading") {
    return <SkeletonCard title="Tech stack (CMS Detector)" />;
  }
  if (slot.status === "error") {
    return (
      <InfoCard
        title="Tech stack (CMS Detector)"
        status="error"
        summary={<span className="text-destructive">Failed</span>}
        expandedContent={null}
        errorMessage={slot.message}
      />
    );
  }

  const techs = slot.data.detected;
  const primary = pickPrimaryTech(techs);

  const summary =
    techs.length === 0 ? (
      <span className="text-muted-foreground">No technologies detected</span>
    ) : primary ? (
      <span className="flex items-center gap-2">
        <TechIcon icon={primary.icon} name={primary.name} />
        <span className="truncate font-medium text-foreground">
          {primary.name}
        </span>
        {primary.version ? (
          <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground">
            v{primary.version}
          </span>
        ) : null}
      </span>
    ) : (
      <span className="truncate">{`${techs.length} technologies detected`}</span>
    );

  return (
    <InfoCard
      title="Tech stack (CMS Detector)"
      status="ok"
      summary={summary}
      expandedContent={
        techs.length === 0 ? (
          <p className="text-comment">{"// no technologies recognised"}</p>
        ) : (
          <ul className="space-y-1.5">
            {techs.slice(0, 20).map((t) => (
              <li
                key={t.name}
                className="flex items-center gap-2 text-xs"
              >
                <TechIcon icon={t.icon} name={t.name} />
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {t.name}
                  {t.version ? (
                    <span className="ml-1.5 font-mono text-[0.625rem] text-muted-foreground">
                      v{t.version}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground">
                  {t.categories[0] ?? "—"}
                </span>
              </li>
            ))}
            {techs.length > 20 ? (
              <li className="text-comment">
                {`// + ${techs.length - 20} more`}
              </li>
            ) : null}
          </ul>
        )
      }
    />
  );
}

/**
 * Pick the "headline" technology to show in the collapsed summary. Order
 * of preference matches what a marketer would call the platform:
 *   CMS → Ecommerce → Page builder → Static site generator → Blogs →
 *   first tech by detection confidence.
 */
function pickPrimaryTech(
  techs: NonNullable<Extract<CmsActionState, { ok: true }>["data"]>["detected"],
) {
  const priority = [
    "CMS",
    "Ecommerce",
    "Page builder",
    "Static site generator",
    "Blogs",
    "Wikis",
    "Photo galleries",
  ];
  for (const cat of priority) {
    const match = techs.find((t) =>
      t.categories.some((c) => c.toLowerCase() === cat.toLowerCase()),
    );
    if (match) return match;
  }
  return techs[0] ?? null;
}

function TechIcon({
  icon,
  name,
}: {
  icon: string | null;
  name: string;
}) {
  if (!icon) {
    return (
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded border border-border bg-muted font-mono text-[0.5rem] uppercase text-muted-foreground">
        {name.slice(0, 2)}
      </span>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`https://www.wappalyzer.com/images/icons/${icon}`}
      alt={name}
      width={20}
      height={20}
      className="size-5 shrink-0 rounded border border-border bg-background object-contain p-0.5"
    />
  );
}

// ─── Speed ──────────────────────────────────────────────────────────

function SpeedCard({
  slot,
}: {
  slot: AsyncSlot<NonNullable<Extract<SpeedActionState, { ok: true }>["data"]>>;
}) {
  if (slot.status === "idle" || slot.status === "loading") {
    return <SkeletonCard title="Website Speed (PageSpeed Insights)" tall />;
  }
  if (slot.status === "error") {
    return (
      <InfoCard
        title="Website Speed (PageSpeed Insights)"
        status="error"
        summary={<span className="text-destructive">Failed</span>}
        expandedContent={null}
        errorMessage={slot.message}
      />
    );
  }

  const mobile = perfScore(slot.data.mobile);
  const desktop = perfScore(slot.data.desktop);

  return (
    <InfoCard
      title="Website Speed (PageSpeed Insights)"
      status="ok"
      summary={
        <span className="flex items-center gap-4">
          <SpeedScorePill label="Mobile" score={mobile} />
          <SpeedScorePill label="Desktop" score={desktop} />
        </span>
      }
      expandedContent={
        <div className="space-y-3">
          {slot.data.notes.length > 0
            ? slot.data.notes.map((n, i) => (
                <p
                  key={i}
                  className="rounded border border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/10%)] px-2 py-1 text-[0.625rem] text-[oklch(0.85_0.14_90)]"
                >
                  {n}
                </p>
              ))
            : null}
          {slot.data.mobile ? (
            <SpeedStrategyDetail
              label="Mobile"
              details={slot.data.mobile}
            />
          ) : null}
          {slot.data.desktop ? (
            <SpeedStrategyDetail
              label="Desktop"
              details={slot.data.desktop}
            />
          ) : null}
        </div>
      }
    />
  );
}

function perfScore(
  details: import("@/lib/audit/pagespeed-details").PagespeedDetails | null,
): number | null {
  if (!details) return null;
  return (
    details.categories.find((c) => c.id === "performance")?.score ?? null
  );
}

function SpeedScorePill({
  label,
  score,
}: {
  label: string;
  score: number | null;
}) {
  const tone =
    score == null
      ? "border-border bg-muted text-muted-foreground"
      : score >= 90
        ? "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]"
        : score >= 50
          ? "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]"
          : "border-destructive/30 bg-destructive/10 text-destructive";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "rounded-md border px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium",
          tone,
        )}
      >
        {score ?? "—"}
      </span>
    </span>
  );
}

function SpeedStrategyDetail({
  label,
  details,
}: {
  label: string;
  details: import("@/lib/audit/pagespeed-details").PagespeedDetails;
}) {
  return (
    <div>
      <p className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <ul className="mt-1.5 grid grid-cols-2 gap-1.5">
        {details.metrics.slice(0, 6).map((m) => (
          <li
            key={m.id}
            className="rounded border border-border bg-card/40 px-2 py-1"
          >
            <p className="truncate font-mono text-[0.5625rem] uppercase tracking-wider text-muted-foreground">
              {m.title}
            </p>
            <p className="font-mono text-[0.6875rem] text-foreground">
              {m.displayValue}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Domain ─────────────────────────────────────────────────────────

function DomainCard({
  slot,
}: {
  slot: AsyncSlot<NonNullable<Extract<DomainActionState, { ok: true }>["data"]>>;
}) {
  if (slot.status === "idle" || slot.status === "loading") {
    return <SkeletonCard title="Domain & Hosting" />;
  }
  if (slot.status === "error") {
    return (
      <InfoCard
        title="Domain & Hosting"
        status="error"
        summary={<span className="text-destructive">Failed</span>}
        expandedContent={null}
        errorMessage={slot.message}
      />
    );
  }

  const { data } = slot;
  const registrarName = data.rdap?.registrar?.name ?? "—";
  const expiryLabel =
    data.daysToExpiry == null
      ? null
      : data.daysToExpiry < 0
        ? `expired ${-data.daysToExpiry}d ago`
        : `expires in ${data.daysToExpiry}d`;

  return (
    <InfoCard
      title="Domain & Hosting"
      status="ok"
      summary={
        <span className="flex items-center justify-between gap-2">
          <span className="truncate">{data.domain}</span>
          {expiryLabel ? (
            <span
              className={cn(
                "shrink-0 font-mono text-[0.625rem]",
                data.daysToExpiry != null && data.daysToExpiry < 30
                  ? "text-destructive"
                  : data.daysToExpiry != null && data.daysToExpiry < 90
                    ? "text-[oklch(0.85_0.14_90)]"
                    : "text-muted-foreground",
              )}
            >
              {expiryLabel}
            </span>
          ) : null}
        </span>
      }
      expandedContent={
        <dl className="space-y-2 text-[0.6875rem]">
          <Row label="Registrar" value={registrarName} />
          <Row
            label="Hosting"
            value={data.geo?.org ?? data.geo?.asnOrg ?? "—"}
          />
          <Row
            label="Location"
            value={
              [data.geo?.city, data.geo?.region, data.geo?.country]
                .filter(Boolean)
                .join(", ") || "—"
            }
          />
          <Row label="IP" value={data.geo?.ip ?? data.dns.a[0] ?? "—"} mono />
          <Row
            label="DNSSEC"
            value={data.rdap?.dnssecEnabled ? "signed" : "not signed"}
          />
          <Row
            label="Email"
            value={
              data.email.hasMx
                ? `MX ${data.email.mxCount} · SPF ${data.email.hasSpf ? "✓" : "✗"} · DMARC ${data.email.hasDmarc ? "✓" : "✗"}`
                : "No MX records"
            }
          />
          <Row
            label="Nameservers"
            value={
              data.dns.ns.length > 0
                ? `${data.dns.ns.length} configured`
                : "—"
            }
          />
        </dl>
      }
    />
  );
}

function Row({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="font-mono text-[0.5625rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("truncate text-foreground", mono && "font-mono text-[0.6875rem]")}>
        {value}
      </dd>
    </div>
  );
}

// ─── Skeleton stub ──────────────────────────────────────────────────

function SkeletonCard({
  title,
  tall = false,
}: {
  title: string;
  tall?: boolean;
}) {
  return (
    <div className="py-3">
      <p className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <Skeleton className={cn("mt-2 w-full", tall ? "h-10" : "h-6")} />
      <p className="text-comment mt-1.5">{"// loading…"}</p>
    </div>
  );
}
