import { notFound } from "next/navigation";

import { findSharedReportByToken } from "@kit/database";

import { MarketingAuditReport } from "@/app/(app)/gm-prospecting/_components/marketing-audit-report";
import { loadAndScore } from "@/app/(app)/gm-prospecting/report/page";

export const metadata = {
  title: "Marketing Audit Report",
};

// Public route — anyone with the token can view. No auth required.
export default async function PublicReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Token format guard before hitting DB (base64url, 12 bytes → 16 chars).
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(token)) notFound();

  const shared = await findSharedReportByToken(token);
  if (!shared) notFound();

  const { businesses, overall, sections, failures } = await loadAndScore(
    shared.placeIds,
  );

  return (
    <div className="min-h-screen bg-background">
      <MarketingAuditReport
        businesses={businesses}
        overall={overall}
        sections={sections}
        failures={failures}
        mode="public"
      />
      <footer className="mx-auto max-w-7xl px-8 pb-10" data-print-hide>
        <p className="text-comment">
          {"// generated with future-cmo · gm prospecting"}
        </p>
      </footer>
    </div>
  );
}
