import { notFound } from "next/navigation";

import { findSharedReportByToken } from "@kit/database";

import { BusinessDetailView } from "@/app/(app)/gm-prospecting/_components/business-detail-view";
import { loadAndScore } from "@/app/(app)/gm-prospecting/_lib/load-and-score";
import { getCachedReviews } from "@/lib/maps/extra-reviews";
import { getCachedWebsiteInfo } from "@/lib/website-info/cache";

export const metadata = {
  title: "Business detail",
};

// Public route — no auth. Token + placeId both validated against the
// shared_reports row before we expose anything.
export default async function PublicBusinessDetailPage({
  params,
}: {
  params: Promise<{ token: string; placeId: string }>;
}) {
  const { token, placeId } = await params;

  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) notFound();
  if (!placeId) notFound();

  const shared = await findSharedReportByToken(token);
  if (!shared) notFound();

  // Guard: placeId must be one the original sharer picked. Stops drive-by
  // probing of arbitrary placeIds via a known share token.
  if (!shared.placeIds.includes(placeId)) notFound();

  // We re-run loadAndScore for the full share's businesses (so the
  // sidebar shows the full audit context). Per-business slow path could
  // optimise later by scoring only the requested placeId, but the share
  // already pays this cost on the main /r/[token] view so it's mostly
  // already cached.
  const { businesses } = await loadAndScore(shared.placeIds);

  const business = businesses.find((b) => b.details.placeId === placeId);
  if (!business) notFound();

  // Pre-fetch both caches in parallel so the page renders fully seeded
  // for previously-scanned data.
  const [cachedReviews, cachedWebsiteInfo] = await Promise.all([
    getCachedReviews(placeId),
    getCachedWebsiteInfo(placeId),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <BusinessDetailView
        business={business}
        backHref={`/r/${token}`}
        backLabel="back to shared report"
        cachedReviews={cachedReviews}
        cachedWebsiteInfo={cachedWebsiteInfo}
      />
    </div>
  );
}
