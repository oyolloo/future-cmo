"use client";

import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@kit/ui/dialog";
import {
  BuildingIcon as Building2,
  CheckIcon as Check,
  ClockIcon as Clock,
  ExternalLinkIcon as ExternalLink,
  FileTextIcon as FileText,
  InfoIcon as Info,
  MapPinIcon as MapPin,
  PhoneIcon as Phone,
  PlusIcon as Plus,
} from "@kit/ui/icons";
import { Input } from "@kit/ui/input";
import { Label } from "@kit/ui/label";
import { cn } from "@kit/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/select";

import { DataTable } from "@/components/ui/data-table";
import { StarRating } from "@/components/ui/star-rating";

import {
  addProspectAction,
  getPlaceDetailsAction,
  searchAction,
  type SearchActionState,
  type SearchResultRow,
} from "../_lib/actions";
import {
  formatRadius,
  LIMIT_OPTIONS,
  RADIUS_OPTIONS,
  type SearchInput,
} from "../_lib/schema";
import { LocationAutocomplete } from "./location-autocomplete";
import { ResultsMap } from "./results-map";

/** Tracks per-row saved state managed by ProspectingTool; passed to cells. */
type RowState = {
  saved: boolean;
  prospectId: string | null;
};

export function ProspectingTool() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [location, setLocation] = useState("");
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [maxResults, setMaxResults] = useState<number>(20);

  const [state, setState] = useState<SearchActionState | null>(null);
  const [isPending, startTransition] = useTransition();

  // placeId -> RowState (saved + prospectId for Audit link).
  // Added rows double as the "selection" set — clicking + Add adds to this
  // map; the Report button generates an audit over all Added rows.
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({});

  // Detail dialog (row click)
  const [selectedRow, setSelectedRow] = useState<SearchResultRow | null>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input: SearchInput = { keyword, location, radiusKm, maxResults };
    startTransition(async () => {
      const result = await searchAction(input);
      setState(result);
      if (result.ok) {
        // Seed rowStates from server-known alreadySaved + savedProspectId.
        const seed: Record<string, RowState> = {};
        for (const r of result.results) {
          seed[r.placeId] = {
            saved: r.alreadySaved,
            prospectId: r.savedProspectId,
          };
        }
        setRowStates(seed);
      }
    });
  };

  const onProspectSaved = (placeId: string, prospectId: string) => {
    setRowStates((prev) => ({
      ...prev,
      [placeId]: { saved: true, prospectId },
    }));
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={onSubmit}
        className="rounded-lg border border-border bg-card p-6"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_160px_120px_auto]">
          <div className="space-y-2">
            <FieldLabel
              htmlFor="keyword"
              hint="Business category (e.g., dentist) or a specific name."
            >
              Search keyword / business name
            </FieldLabel>
            <Input
              id="keyword"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="e.g., dentist, lawyer, plumber"
              required
            />
          </div>

          <div className="space-y-2">
            <FieldLabel
              htmlFor="location"
              hint="City, state, or full address — anything Google Maps understands."
            >
              Location
            </FieldLabel>
            <LocationAutocomplete
              id="location"
              value={location}
              onChange={setLocation}
              placeholder="e.g., Scottsdale, AZ"
              required
            />
          </div>

          <div className="space-y-2">
            <FieldLabel
              htmlFor="radius"
              hint="How far from the location center to search."
            >
              Radius
            </FieldLabel>
            <Select
              value={String(radiusKm)}
              onValueChange={(v: string) => setRadiusKm(Number(v))}
            >
              <SelectTrigger id="radius" className="w-full mb-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RADIUS_OPTIONS.map((km) => (
                  <SelectItem key={km} value={String(km)}>
                    {formatRadius(km)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <FieldLabel
              htmlFor="limit"
              hint="How many results to return. Google Places caps at 20 per call."
            >
              Limit
            </FieldLabel>
            <Select
              value={String(maxResults)}
              onValueChange={(v: string) => setMaxResults(Number(v))}
            >
              <SelectTrigger id="limit" className="w-full mb-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LIMIT_OPTIONS.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} results
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              type="submit"
              disabled={isPending}
              className="w-full md:w-auto"
            >
              {isPending ? "Searching…" : "Search"}
            </Button>
          </div>
        </div>

        {state && !state.ok ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {state.error.message}
          </p>
        ) : null}
      </form>

      {state?.ok ? (
        <Results
          results={state.results}
          rowStates={rowStates}
          onProspectSaved={onProspectSaved}
          onOpenDetail={setSelectedRow}
          onGenerateReport={() => {
            const placeIds = Object.entries(rowStates)
              .filter(([, s]) => s.saved)
              .map(([placeId]) => placeId);
            if (placeIds.length === 0) return;
            const params = new URLSearchParams();
            for (const id of placeIds) params.append("placeId", id);
            router.push(`/gm-prospecting/report?${params.toString()}`);
          }}
        />
      ) : !state ? (
        <EmptyHint />
      ) : null}

      <DetailDialog
        row={selectedRow}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}

function EmptyHint() {
  return (
    <section className="rounded-lg border border-border bg-card p-10 text-center">
      <div className="inline-flex size-12 items-center justify-center rounded-full border border-border bg-muted">
        <MapPin className="size-5 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-base font-medium">
        Discover hot leads around you
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Pull real businesses from Google Maps — no scrapers, no spreadsheets.
      </p>
      <p className="text-comment mt-3">{"// type a keyword + location to start"}</p>
    </section>
  );
}

function Results({
  results,
  rowStates,
  onProspectSaved,
  onOpenDetail,
  onGenerateReport,
}: {
  results: SearchResultRow[];
  rowStates: Record<string, RowState>;
  onProspectSaved: (placeId: string, prospectId: string) => void;
  onOpenDetail: (row: SearchResultRow) => void;
  onGenerateReport: () => void;
}) {
  if (results.length === 0) {
    return (
      <section className="rounded-lg border border-border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">No results found.</p>
        <p className="text-comment mt-2">
          {"// try a wider radius or different keyword"}
        </p>
      </section>
    );
  }

  const columns = buildColumns(rowStates, onProspectSaved);
  const addedCount = Object.values(rowStates).filter((s) => s.saved).length;

  return (
    <section className="space-y-6">
      <ResultsMap results={results} />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-sm bg-primary" />
          <h2 className="text-base font-medium">
            Pick a business to generate an audit
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
            {addedCount}/{results.length} added
          </span>
          <Button
            type="button"
            size="sm"
            disabled={addedCount === 0}
            onClick={onGenerateReport}
          >
            <FileText className="size-3.5" />
            <span>Report</span>
          </Button>
        </div>
      </header>

      <DataTable
        columns={columns}
        data={results}
        getRowId={(row) => row.placeId}
        pageSize={10}
        emptyMessage="No results."
        onRowClick={onOpenDetail}
      />
    </section>
  );
}

function buildColumns(
  rowStates: Record<string, RowState>,
  onProspectSaved: (placeId: string, prospectId: string) => void,
): ColumnDef<SearchResultRow>[] {
  return [
    {
      id: "business",
      header: "Business",
      accessorKey: "name",
      cell: ({ row }) => <BusinessCell row={row.original} />,
    },
    {
      id: "conversion",
      header: "Conversion",
      accessorFn: (r) => r.score.score,
      cell: ({ row }) => (
        <ConversionBadge
          score={row.original.score.score}
          band={row.original.score.band}
        />
      ),
      size: 140,
    },
    {
      id: "presence",
      header: "Online presence",
      enableSorting: false,
      cell: ({ row }) => (
        <OnlinePresence
          website={row.original.website}
          googleMapsUri={row.original.googleMapsUri}
        />
      ),
      size: 140,
    },
    {
      id: "rating",
      header: "Rating",
      accessorFn: (r) => r.rating ?? 0,
      cell: ({ row }) => {
        const r = row.original;
        if (r.rating == null) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <span className="inline-flex items-center gap-2 text-sm">
            <StarRating rating={r.rating} size="sm" showValue={false} />
            <span className="font-medium">{r.rating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">
              ({r.reviewCount ?? 0})
            </span>
          </span>
        );
      },
      size: 140,
    },
    {
      id: "action",
      header: "Action",
      enableSorting: false,
      cell: ({ row }) => (
        <ActionCell
          row={row.original}
          state={rowStates[row.original.placeId]}
          onSaved={onProspectSaved}
        />
      ),
      size: 160,
      meta: { align: "right" },
    },
  ];
}

function ActionCell({
  row,
  state,
  onSaved,
}: {
  row: SearchResultRow;
  state: RowState | undefined;
  onSaved: (placeId: string, prospectId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const saved = state?.saved ?? row.alreadySaved;

  if (saved && state?.prospectId) {
    return (
      <Link
        href={`/gm-prospecting/${state.prospectId}`}
        className="inline-flex items-center gap-1.5 rounded-md border border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] px-2.5 py-1 font-mono text-[0.6875rem] uppercase tracking-wider text-[oklch(0.80_0.14_160)] hover:bg-[oklch(0.72_0.14_160/25%)]"
        title="Added — open audit"
      >
        <Check className="size-3" />
        Added
      </Link>
    );
  }

  const onAdd = () => {
    setError(null);
    startTransition(async () => {
      const result = await addProspectAction({
        placeId: row.placeId,
        name: row.name,
        formattedAddress: row.formattedAddress,
        phone: row.phone,
        website: row.website,
      });
      if (result.ok) {
        onSaved(row.placeId, result.prospectId);
      } else {
        setError(result.error.message);
      }
    });
  };

  return (
    <span className="inline-flex flex-col items-end gap-1 align-middle">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={onAdd}
        disabled={isPending}
        aria-label="Add to prospects"
      >
        <Plus className="size-3.5" />
        <span>{isPending ? "Saving…" : "Add"}</span>
      </Button>
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}

const GBP_ICON = "https://cdn-icons-png.flaticon.com/512/2991/2991235.png";
const WEB_ICON = "https://cdn-icons-png.flaticon.com/512/174/174881.png";

/**
 * Build a Google Places Photo media URL. Key is the public Maps key (HTTP
 * referrer-restricted in prod). Returns null when either the photo name or
 * the key is missing.
 */
function placePhotoUrl(photoName: string | null, size = 80): string | null {
  if (!photoName) return null;
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  return `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=${size}&maxWidthPx=${size}&key=${key}`;
}

function BusinessCell({ row }: { row: SearchResultRow }) {
  const photo = placePhotoUrl(row.photoName, 80);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
        {photo ? (
          <Image
            src={photo}
            alt={row.name}
            width={40}
            height={40}
            className="size-full object-cover"
            unoptimized
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Building2 className="size-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate font-medium">{row.name}</p>
        {row.formattedAddress ? (
          <p className="truncate font-mono text-xs text-muted-foreground">
            {row.formattedAddress}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function DetailDialog({
  row,
  onClose,
}: {
  row: SearchResultRow | null;
  onClose: () => void;
}) {
  const open = row !== null;
  const placeId = row?.placeId;

  // Fetch Place Details lazily when the dialog opens. Cached server-side
  // for 30 days, so re-opens are free.
  const detailsQuery = useQuery({
    queryKey: ["placeDetails", placeId],
    queryFn: async () => {
      if (!placeId) throw new Error("no placeId");
      const res = await getPlaceDetailsAction(placeId);
      if (!res.ok) throw new Error(res.error.message);
      return res.details;
    },
    enabled: !!placeId,
    staleTime: 5 * 60 * 1000, // client-side dedupe for 5 minutes
    retry: false,
  });

  // Prefer richer photos from Place Details when available.
  const heroPhotoName =
    detailsQuery.data?.photoNames[0] ?? row?.photoName ?? null;
  const photo = placePhotoUrl(heroPhotoName, 800);

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0 max-h-[90vh] grid-rows-[auto_1fr]">
        {row ? (
          <>
            <div className="relative aspect-[16/8] w-full overflow-hidden rounded-t-lg bg-muted">
              {photo ? (
                <Image
                  src={photo}
                  alt={row.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 720px"
                  className="object-cover"
                  unoptimized
                  priority
                />
              ) : (
                <div className="flex size-full items-center justify-center">
                  <Building2 className="size-12 text-muted-foreground" />
                </div>
              )}
            </div>

            <div className="space-y-5 overflow-y-auto p-6">
              <DialogHeader>
                <DialogTitle>{row.name}</DialogTitle>
                {row.formattedAddress ? (
                  <DialogDescription>{row.formattedAddress}</DialogDescription>
                ) : null}
              </DialogHeader>

              <div className="flex flex-wrap items-center gap-2">
                {row.rating != null ? (
                  <span className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                    <StarRating rating={row.rating} size="sm" showValue={false} />
                    <span className="font-medium">{row.rating.toFixed(1)}</span>
                    <span className="text-muted-foreground">
                      ({row.reviewCount ?? 0} reviews)
                    </span>
                  </span>
                ) : null}
                <ConversionBadge
                  score={row.score.score}
                  band={row.score.band}
                />
                {row.types.slice(0, 3).map((t) => (
                  <span
                    key={t}
                    className="rounded-md border border-border bg-muted/40 px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground"
                  >
                    {t.replace(/_/g, " ")}
                  </span>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {row.phone ? (
                  <a
                    href={`tel:${row.phone}`}
                    className="flex items-center gap-2 rounded-md border border-border bg-card/50 p-3 text-sm hover:bg-muted/40"
                  >
                    <Phone className="size-4 text-muted-foreground" />
                    <span>{row.phone}</span>
                  </a>
                ) : null}
                {row.website ? (
                  <a
                    href={row.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 truncate rounded-md border border-border bg-card/50 p-3 text-sm hover:bg-muted/40"
                  >
                    <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">
                      {row.website.replace(/^https?:\/\//, "")}
                    </span>
                  </a>
                ) : null}
                {row.googleMapsUri ? (
                  <a
                    href={row.googleMapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-md border border-border bg-card/50 p-3 text-sm hover:bg-muted/40 sm:col-span-2"
                  >
                    <MapPin className="size-4 text-muted-foreground" />
                    <span>Open in Google Maps</span>
                  </a>
                ) : null}
              </div>

              <DetailsSections
                isLoading={detailsQuery.isLoading}
                isError={detailsQuery.isError}
                errorMessage={
                  detailsQuery.error instanceof Error
                    ? detailsQuery.error.message
                    : null
                }
                details={detailsQuery.data ?? null}
              />
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailsSections({
  isLoading,
  isError,
  errorMessage,
  details,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  details: import("@/lib/maps/places").PlaceDetails | null;
}) {
  if (isLoading) {
    return (
      <div className="rounded-md border border-dashed border-border bg-background p-4">
        <p className="text-label">Loading reviews · about · hours</p>
        <p className="text-comment mt-2">
          {"// fetching from Place Details API (cached 30 days)"}
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
        <p className="text-sm text-destructive" role="alert">
          {errorMessage ?? "Could not load details."}
        </p>
      </div>
    );
  }

  if (!details) return null;

  return (
    <div className="space-y-5">
      {details.editorialSummary ? (
        <section>
          <p className="text-label mb-2">About</p>
          <p className="text-sm leading-relaxed text-foreground">
            {details.editorialSummary}
          </p>
        </section>
      ) : null}

      {details.weekdayHours.length > 0 ? (
        <section>
          <p className="text-label mb-2 flex items-center gap-2">
            <Clock className="size-3.5" />
            Hours
            {details.openNow != null ? (
              <span
                className={cn(
                  "ml-2 rounded-md px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider",
                  details.openNow
                    ? "bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {details.openNow ? "Open now" : "Closed"}
              </span>
            ) : null}
          </p>
          <ul className="space-y-1">
            {details.weekdayHours.map((line) => (
              <li
                key={line}
                className="font-mono text-xs text-muted-foreground"
              >
                {line}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {details.reviews.length > 0 ? (
        <section>
          <p className="text-label mb-3">
            Reviews · {details.reviews.length} most recent
          </p>
          <ul className="space-y-3">
            {details.reviews.slice(0, 5).map((review) => (
              <li
                key={review.id}
                className="rounded-md border border-border bg-card/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {review.authorName}
                    </span>
                    <StarRating
                      rating={review.rating}
                      size="xs"
                      showValue
                      valueLabel={`(${review.rating})`}
                    />
                  </div>
                  <span className="font-mono text-[0.625rem] text-muted-foreground">
                    {review.relativeTime}
                  </span>
                </div>
                {review.text ? (
                  <p className="mt-2 text-sm leading-relaxed text-foreground line-clamp-4">
                    {review.text}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!details.editorialSummary &&
      details.weekdayHours.length === 0 &&
      details.reviews.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background p-4">
          <p className="text-comment">
            {"// no extra detail returned from Place Details for this listing"}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function OnlinePresence({
  website,
  googleMapsUri,
}: {
  website: string | null;
  googleMapsUri: string | null;
}) {
  const hasWebsite = !!website;
  return (
    <div className="inline-flex items-center gap-2">
      <BrandIcon
        src={GBP_ICON}
        alt="Google Business Profile"
        ok
        label="Google Business Profile · listed"
        href={googleMapsUri ?? undefined}
      />
      <BrandIcon
        src={WEB_ICON}
        alt="Website"
        ok={hasWebsite}
        label={hasWebsite ? `Visit ${website}` : "Website · missing"}
        href={website ?? undefined}
      />
    </div>
  );
}

function BrandIcon({
  src,
  alt,
  ok,
  label,
  href,
}: {
  src: string;
  alt: string;
  ok: boolean;
  label: string;
  href?: string;
}) {
  const className = cn(
    "relative inline-flex size-8 items-center justify-center rounded-md border bg-card",
    ok ? "border-border" : "border-destructive/30 opacity-60 grayscale",
    href && "transition-colors hover:border-primary/40 hover:bg-card/70",
  );

  const inner = (
    <>
      <Image src={src} alt={alt} width={20} height={20} unoptimized />
      <span
        className={cn(
          "absolute -right-1 -bottom-1 inline-flex size-3.5 items-center justify-center rounded-full border border-card text-[0.5rem] font-bold",
          ok
            ? "bg-[oklch(0.72_0.14_160)] text-background"
            : "bg-destructive text-background",
        )}
        aria-hidden
      >
        {ok ? "✓" : "✕"}
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={label}
        aria-label={label}
        className={className}
      >
        {inner}
      </a>
    );
  }

  return (
    <span title={label} aria-label={label} className={className}>
      {inner}
    </span>
  );
}

function FieldLabel({
  htmlFor,
  hint,
  children,
}: {
  htmlFor: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Label htmlFor={htmlFor} className="inline-flex items-center gap-1.5">
      <span>{children}</span>
      <span
        title={hint}
        className="cursor-help text-muted-foreground"
        aria-label={hint}
      >
        <Info className="size-3" />
      </span>
    </Label>
  );
}

function ConversionBadge({
  score,
  band,
}: {
  score: number;
  band: "unlikely" | "moderate" | "strong";
}) {
  const styles: Record<typeof band, string> = {
    unlikely: "border-destructive/30 bg-destructive/10 text-destructive",
    moderate:
      "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
    strong:
      "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
  };
  const labels: Record<typeof band, string> = {
    unlikely: "Unlikely",
    moderate: "Moderate",
    strong: "Strong",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider",
        styles[band],
      )}
    >
      <span>{score}%</span>
      <span>{labels[band]}</span>
    </span>
  );
}
