"use client";

import { useMemo, useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { cn } from "@kit/ui/lib/utils";
import { Pagination } from "@kit/ui/pagination";

import { StarRating } from "@/components/ui/star-rating";
import type { ExtendedReview } from "@/lib/maps/extra-reviews";

import { loadExtraReviewsAction } from "../_lib/reviews-actions";
import type { RankedBusiness } from "./marketing-audit-report";

type Props = {
  initialReviews: RankedBusiness["details"]["reviews"];
  googleMapsUri: string | null;
  placeId: string;
  /**
   * Server-fetched cached reviews. When present, the component skips the
   * "Load all reviews" button and renders the paginated full list on
   * first paint — no client roundtrip needed.
   */
  initialCached?: {
    reviews: ExtendedReview[];
    fetchedAt: string;
  } | null;
};

type LoadedReviews = {
  reviews: ExtendedReview[];
  cached: boolean;
  fetchedAt: string;
};

/**
 * Reviews section. If a cached snapshot was passed from the server,
 * renders the paginated full list immediately. Otherwise shows the 5
 * Google Places API reviews + "Load all reviews" button — click triggers
 * cache-aware scrape (cached 7 days in place_reviews_cache).
 */
export function ReviewsBlock({
  initialReviews,
  googleMapsUri,
  placeId,
  initialCached,
}: Props) {
  const [loaded, setLoaded] = useState<LoadedReviews | null>(
    initialCached
      ? {
          reviews: initialCached.reviews,
          cached: true,
          fetchedAt: initialCached.fetchedAt,
        }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = (forceRefresh: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await loadExtraReviewsAction(googleMapsUri, placeId, {
        forceRefresh,
      });
      if (result.ok) setLoaded(result.data);
      else setError(result.error.message);
    });
  };

  return (
    <section className="rounded-lg border border-border bg-card p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-label">
          {loaded
            ? `Reviews · ${loaded.reviews.length} loaded`
            : `Reviews · ${initialReviews.length} most recent`}
        </p>
        <div className="flex items-center gap-2">
          {loaded ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => load(true)}
              disabled={isPending}
              title="Re-scrape and update the cache"
            >
              {isPending ? "Refreshing…" : "Refresh"}
            </Button>
          ) : googleMapsUri ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => load(false)}
              disabled={isPending}
            >
              {isPending ? "Loading…" : "Load all reviews"}
            </Button>
          ) : null}
        </div>
      </header>

      {loaded ? <CacheBadge meta={loaded} /> : null}

      {error ? (
        <p
          className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {loaded ? (
        <ExtendedReviewsList reviews={loaded.reviews} />
      ) : (
        <InitialReviewsList reviews={initialReviews} />
      )}

      {!loaded && googleMapsUri ? (
        <p className="text-comment mt-3">
          {
            "// Google Places API caps at 5 — click 'Load all reviews' to pull every review (with owner replies). Cached 7 days."
          }
        </p>
      ) : null}
    </section>
  );
}

function CacheBadge({ meta }: { meta: LoadedReviews }) {
  const date = new Date(meta.fetchedAt);
  const label = Number.isNaN(date.getTime())
    ? meta.fetchedAt
    : date.toLocaleString();
  return (
    <p className="text-comment mt-1">
      {meta.cached
        ? `// served from cache · scraped ${label}`
        : `// freshly scraped just now · cached for 7 days`}
    </p>
  );
}

// ─── Initial (Places API) ────────────────────────────────────────────

function InitialReviewsList({
  reviews,
}: {
  reviews: RankedBusiness["details"]["reviews"];
}) {
  if (reviews.length === 0) {
    return (
      <p className="text-comment mt-3">{"// no reviews available"}</p>
    );
  }
  return (
    <ul className="mt-3 space-y-3">
      {reviews.slice(0, 5).map((review) => (
        <li
          key={review.id}
          className="rounded-md border border-border bg-card/40 p-3"
        >
          <ReviewHeader
            name={review.authorName}
            rating={review.rating}
            timeLabel={review.relativeTime}
          />
          {review.text ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {review.text}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ─── Extended (scraped + paginated) ─────────────────────────────────

function ExtendedReviewsList({ reviews }: { reviews: ExtendedReview[] }) {
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  /** null = all ratings · 1-5 = specific star count · "positive" = 4-5 · "negative" = 1-2. */
  const [filter, setFilter] = useState<RatingFilter>(null);

  // Distribution counts — computed once, used by the chip row to show
  // how many reviews live at each rating tier without re-counting on
  // every render.
  const counts = useMemo(() => {
    const buckets: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const rounded = Math.round(r.rating);
      if (rounded >= 1 && rounded <= 5) buckets[rounded]!++;
    }
    return buckets;
  }, [reviews]);

  const filtered = useMemo(
    () => applyRatingFilter(reviews, filter),
    [reviews, filter],
  );

  const pageCount = Math.max(Math.ceil(filtered.length / pageSize), 1);
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const visible = useMemo(() => {
    const start = safePageIndex * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePageIndex, pageSize]);

  const changeFilter = (next: RatingFilter) => {
    setFilter(next);
    setPageIndex(0);
  };

  return (
    <>
      <RatingFilterBar
        total={reviews.length}
        counts={counts}
        active={filter}
        onChange={changeFilter}
      />

      {filtered.length === 0 ? (
        <div className="mt-3 rounded-md border border-dashed border-border bg-background p-6 text-center">
          <p className="text-sm text-muted-foreground">
            No reviews match this filter.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {visible.map((review) => (
            <li
              key={review.id}
              className="rounded-md border border-border bg-card/40 p-3"
            >
              <ReviewHeader
                name={review.author.name}
                rating={review.rating}
                timeLabel={formatRelativeIso(review.publishedAt)}
              />
              {review.text ? (
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {review.text}
                </p>
              ) : null}
              {review.images.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {review.images.slice(0, 6).map((url, i) => (
                    <li
                      key={`${review.id}-img-${i}`}
                      className="size-16 overflow-hidden rounded border border-border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt={`review photo ${i + 1}`}
                        className="size-full object-cover"
                        loading="lazy"
                        // Google's lh3.googleusercontent.com 403s when
                        // the Referer header includes our origin. No
                        // referer lets the CDN serve normally.
                        referrerPolicy="no-referrer"
                      />
                    </li>
                  ))}
                </ul>
              ) : null}

              {review.ownerResponse ? (
                <OwnerReplyCard reply={review.ownerResponse} />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {filtered.length > 0 ? (
        <div className="mt-5">
          <Pagination
            pageIndex={safePageIndex}
            pageCount={pageCount}
            pageSize={pageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            totalRows={filtered.length}
            onPageIndexChange={(i) => setPageIndex(i)}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPageIndex(0);
            }}
          />
        </div>
      ) : null}
    </>
  );
}

// ─── Rating filter ──────────────────────────────────────────────────

type RatingFilter = null | 1 | 2 | 3 | 4 | 5 | "positive" | "negative";

function applyRatingFilter(
  reviews: ExtendedReview[],
  filter: RatingFilter,
): ExtendedReview[] {
  if (filter === null) return reviews;
  if (filter === "positive")
    return reviews.filter((r) => r.rating >= 4);
  if (filter === "negative")
    return reviews.filter((r) => r.rating <= 2);
  return reviews.filter((r) => Math.round(r.rating) === filter);
}

function RatingFilterBar({
  total,
  counts,
  active,
  onChange,
}: {
  total: number;
  counts: Record<number, number>;
  active: RatingFilter;
  onChange: (next: RatingFilter) => void;
}) {
  const positiveCount = (counts[4] ?? 0) + (counts[5] ?? 0);
  const negativeCount = (counts[1] ?? 0) + (counts[2] ?? 0);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-background p-2">
      <FilterChip
        label="All"
        count={total}
        active={active === null}
        onClick={() => onChange(null)}
      />
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      {([5, 4, 3, 2, 1] as const).map((star) => (
        <FilterChip
          key={star}
          label={`${star}★`}
          count={counts[star] ?? 0}
          active={active === star}
          onClick={() => onChange(star)}
        />
      ))}
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <FilterChip
        label="Positive"
        count={positiveCount}
        active={active === "positive"}
        onClick={() => onChange("positive")}
        tone="ok"
      />
      <FilterChip
        label="Negative"
        count={negativeCount}
        active={active === "negative"}
        onClick={() => onChange("negative")}
        tone="fail"
      />
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  tone = "neutral",
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: "neutral" | "ok" | "fail";
}) {
  const activeStyles: Record<typeof tone, string> = {
    neutral: "border-primary bg-primary text-primary-foreground",
    ok: "border-[oklch(0.72_0.14_160)] bg-[oklch(0.72_0.14_160/25%)] text-[oklch(0.80_0.14_160)]",
    fail: "border-destructive bg-destructive/20 text-destructive",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? activeStyles[tone]
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "rounded px-1 text-[0.625rem]",
          active ? "bg-background/30" : "bg-muted/50",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function OwnerReplyCard({
  reply,
}: {
  reply: NonNullable<ExtendedReview["ownerResponse"]>;
}) {
  return (
    <div className="mt-3 ml-6 rounded-md border-l-2 border-primary/40 bg-primary/5 px-3 py-2">
      <p className="font-mono text-[0.625rem] uppercase tracking-wider text-primary">
        Owner response · {formatRelativeIso(reply.publishedAt)}
      </p>
      <p className="mt-1.5 text-xs leading-relaxed text-foreground">
        {reply.text}
      </p>
    </div>
  );
}

// ─── Shared bits ─────────────────────────────────────────────────────

function ReviewHeader({
  name,
  rating,
  timeLabel,
}: {
  name: string;
  rating: number;
  timeLabel: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-medium">{name}</span>
        <StarRating
          rating={rating}
          size="xs"
          showValue
          valueLabel={`(${rating})`}
        />
      </div>
      {timeLabel ? (
        <span className="font-mono text-[0.625rem] text-muted-foreground">
          {timeLabel}
        </span>
      ) : null}
    </div>
  );
}

function formatRelativeIso(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const diffMs = Date.now() - d.getTime();
  const day = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (day < 1) return "today";
  if (day < 7) return `${day}d ago`;
  if (day < 30) return `${Math.floor(day / 7)}w ago`;
  if (day < 365) return `${Math.floor(day / 30)}mo ago`;
  return `${Math.floor(day / 365)}y ago`;
}
