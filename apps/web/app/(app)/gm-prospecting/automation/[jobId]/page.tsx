import Link from "next/link";
import { notFound } from "next/navigation";

import { findAutomationJobById } from "@kit/database";

import { requireUser } from "@/lib/auth/session";

import { JobDetailView } from "./_components/job-detail-view";

export const metadata = {
  title: "Automation Job · future-cmo",
};

export default async function AutomationJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const user = await requireUser();
  const { jobId } = await params;

  const job = await findAutomationJobById(user.id, jobId);
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <Link
        href="/gm-prospecting/reports"
        className="text-comment hover:text-foreground"
      >
        ← back to reports
      </Link>

      <JobDetailView initialJob={JSON.parse(JSON.stringify(job))} />
    </div>
  );
}
