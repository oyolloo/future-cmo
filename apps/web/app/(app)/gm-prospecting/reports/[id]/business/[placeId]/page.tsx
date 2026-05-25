import { notFound } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { getCachedReviews } from "@/lib/maps/extra-reviews";
import { getReport } from "@/lib/reports/service";
import { getCachedWebsiteInfo } from "@/lib/website-info/cache";

import { BusinessDetailView } from "../../../../_components/business-detail-view";

export const metadata = {
  title: "Business detail · future-cmo",
};

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string; placeId: string }>;
}) {
  const user = await requireUser();
  const { id, placeId } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  if (!placeId) notFound();

  const result = await getReport(user.id, id);
  if (!result) notFound();

  const business = result.snapshot.businesses.find(
    (b) => b.details.placeId === placeId,
  );
  if (!business) notFound();

  // Pre-fetch both caches in parallel so the page renders fully seeded
  // — no client roundtrips needed for previously-scanned data.
  const [cachedReviews, cachedWebsiteInfo] = await Promise.all([
    getCachedReviews(placeId),
    getCachedWebsiteInfo(placeId),
  ]);

  return (
    <BusinessDetailView
      business={business}
      backHref={`/gm-prospecting/reports/${id}`}
      backLabel="back to report"
      cachedReviews={cachedReviews}
      cachedWebsiteInfo={cachedWebsiteInfo}
    />
  );
}
