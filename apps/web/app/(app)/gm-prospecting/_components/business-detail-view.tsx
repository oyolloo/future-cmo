"use client";

import Link from "next/link";

import {
  ClockIcon as Clock,
  ExternalLinkIcon as ExternalLink,
  MapPinIcon as MapPin,
  PhoneIcon as Phone,
} from "@kit/ui/icons";
import { cn } from "@kit/ui/lib/utils";

import { StarRating } from "@/components/ui/star-rating";
import { auditBand, type AuditBand } from "@/lib/audit/score";
import type { ExtendedReview } from "@/lib/maps/extra-reviews";
import type { CachedWebsiteInfo } from "@/lib/website-info/cache";

import type { RankedBusiness } from "./marketing-audit-report";
import { ReviewsBlock } from "./reviews-block";
import { WebsiteInfoPanel } from "./website-info-panel";

type Props = {
  business: RankedBusiness;
  /** Back-link to the report / share page that this view is opened from. */
  backHref: string;
  backLabel?: string;
  /**
   * Pre-fetched extended reviews from the DB cache, when present. Seeds
   * ReviewsBlock's loaded state so the page renders straight to the
   * paginated full list instead of the "Load all reviews" button.
   */
  cachedReviews?: {
    reviews: ExtendedReview[];
    fetchedAt: string;
  } | null;
  /**
   * Pre-fetched website info from `business_website_info_cache`. When
   * any slot is populated, WebsiteInfoPanel skips its Request button and
   * renders the cached data immediately.
   */
  cachedWebsiteInfo?: CachedWebsiteInfo | null;
};

/**
 * Full-page detail view for one business in an audit report. Main column
 * holds editorial content (facts, about, hours, reviews, photos); right
 * sidebar (sticky on lg+) holds the audit score breakdown — separated so
 * the user can keep scoring info in view while scrolling notes / reviews.
 */
export function BusinessDetailView({
  business,
  backHref,
  backLabel = "back to report",
  cachedReviews,
  cachedWebsiteInfo,
}: Props) {
  const { details } = business;
  const heroPhoto = placePhotoUrl(details.photoNames[0] ?? null, 1200);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <Link
        href={backHref}
        className="text-comment hover:text-foreground"
      >
        ← {backLabel}
      </Link>

      {/* Hero photo */}
      <div className="relative mt-6 aspect-[21/9] w-full overflow-hidden rounded-lg border border-border bg-muted">
        {heroPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroPhoto}
            alt={details.name}
            className="size-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-muted-foreground">
            <span className="font-mono text-xs uppercase tracking-wider">
              no photo
            </span>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <main className="space-y-6">
          <Header business={business} />
          <QuickFacts business={business} />
          {details.editorialSummary ? (
            <AboutBlock summary={details.editorialSummary} />
          ) : null}
          <ReviewsBlock
            initialReviews={details.reviews}
            googleMapsUri={details.googleMapsUri}
            placeId={details.placeId}
            initialCached={cachedReviews ?? null}
          />
          <PhotosStrip
            photoNames={details.photoNames}
            placeName={details.name}
          />
        </main>

        {/* Right sidebar — only Website Information sticks to the top.
            Audit breakdown + Hours scroll out naturally as the user
            reads down the main column; Website Information stays
            visible because that's the panel users compare against
            content while scrolling reviews / photos. */}
        <aside className="space-y-4">
          <SidebarPanel business={business} />
          {details.weekdayHours.length > 0 ? (
            <HoursBlock
              weekdayHours={details.weekdayHours}
              openNow={details.openNow}
            />
          ) : null}
          <div className="lg:sticky lg:top-16">
            <WebsiteInfoPanel
              placeId={details.placeId}
              websiteUrl={details.website}
              initialCache={cachedWebsiteInfo ?? null}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Main column blocks ──────────────────────────────────────────────

function Header({ business }: { business: RankedBusiness }) {
  const { details } = business;
  return (
    <header>
      <p className="text-label">— business detail</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        {details.name}
      </h1>
      {details.formattedAddress ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {details.formattedAddress}
        </p>
      ) : null}
    </header>
  );
}

function QuickFacts({ business }: { business: RankedBusiness }) {
  const { details } = business;
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {details.rating != null ? (
          <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
            <StarRating rating={details.rating} size="sm" showValue={false} />
            <span className="font-medium">{details.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({details.reviewCount ?? 0} reviews)
            </span>
          </span>
        ) : null}
        {details.types.slice(0, 4).map((t) => (
          <span
            key={t}
            className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground"
          >
            {t.replace(/_/g, " ")}
          </span>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {details.phone ? (
          <ContactLink href={`tel:${details.phone}`} icon={Phone}>
            {details.phone}
          </ContactLink>
        ) : null}
        {details.website ? (
          <ContactLink
            href={details.website}
            icon={ExternalLink}
            external
            truncate
          >
            {details.website.replace(/^https?:\/\//, "")}
          </ContactLink>
        ) : null}
        {details.googleMapsUri ? (
          <ContactLink
            href={details.googleMapsUri}
            icon={MapPin}
            external
            className="sm:col-span-2"
          >
            Open in Google Maps
          </ContactLink>
        ) : null}
      </div>
    </section>
  );
}

function ContactLink({
  href,
  icon: Icon,
  external = false,
  truncate = false,
  className,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  truncate?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-md border border-border bg-card/50 p-3 text-sm hover:bg-muted/40",
        truncate && "truncate",
        className,
      )}
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className={truncate ? "truncate" : undefined}>{children}</span>
    </a>
  );
}

function AboutBlock({ summary }: { summary: string }) {
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <p className="text-label mb-2">About</p>
      <p className="text-sm leading-relaxed text-foreground">{summary}</p>
    </section>
  );
}

function HoursBlock({
  weekdayHours,
  openNow,
}: {
  weekdayHours: string[];
  openNow: boolean | null;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <p className="text-label mb-2 flex items-center gap-2">
        <Clock className="size-3.5" />
        Hours
        {openNow != null ? (
          <span
            className={cn(
              "ml-2 rounded-md px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider",
              openNow
                ? "bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]"
                : "bg-destructive/10 text-destructive",
            )}
          >
            {openNow ? "Open now" : "Closed"}
          </span>
        ) : null}
      </p>
      <ul className="space-y-1">
        {weekdayHours.map((line) => (
          <li key={line} className="font-mono text-xs text-muted-foreground">
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}


function PhotosStrip({
  photoNames,
  placeName,
}: {
  photoNames: string[];
  placeName: string;
}) {
  const thumbs = photoNames.slice(1, 13); // hero already shown at top
  if (thumbs.length === 0) return null;
  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <p className="text-label mb-3">
        More photos · {photoNames.length} total
      </p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
        {thumbs.map((name, i) => {
          const url = placePhotoUrl(name, 280);
          if (!url) return null;
          return (
            <li
              key={name}
              className="aspect-square overflow-hidden rounded-md border border-border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`${placeName} photo ${i + 2}`}
                className="size-full object-cover"
                loading="lazy"
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ─── Right sidebar ───────────────────────────────────────────────────

function SidebarPanel({ business }: { business: RankedBusiness }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">Audit breakdown · this business</p>
      <ul className="mt-2 divide-y divide-border">
        {business.sections.map((s) => (
          <SectionScoreRow key={s.key} section={s} />
        ))}
      </ul>
    </div>
  );
}

function SectionScoreRow({
  section,
}: {
  section: RankedBusiness["sections"][number];
}) {
  const band: AuditBand = auditBand(section.score);
  const badgeStyles: Record<AuditBand, string> = {
    weak: "border-destructive/30 bg-destructive/10 text-destructive",
    warming:
      "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
    strong:
      "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
  };

  return (
    <li className="flex items-center justify-between gap-2 py-1.5">
      <span className="truncate text-xs text-foreground">{section.label}</span>
      <span
        className={cn(
          "shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-wider",
          section.status === "placeholder"
            ? "border-border bg-muted/40 text-muted-foreground/60"
            : badgeStyles[band],
        )}
      >
        {section.score}%
      </span>
    </li>
  );
}

// ─── Helper ──────────────────────────────────────────────────────────

function placePhotoUrl(photoName: string | null, size = 800): string | null {
  if (!photoName) return null;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  return `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${size}&maxWidthPx=${size}&key=${key}`;
}
