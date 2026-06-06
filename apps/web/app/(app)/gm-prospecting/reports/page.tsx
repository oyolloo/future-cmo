import Link from "next/link";

import { listAutomationJobsByUser } from "@kit/database";

import { buttonVariants } from "@kit/ui/button";

import { requireUser } from "@/lib/auth/session";
import { listReports } from "@/lib/reports/service";

import { AutomationJobsTable } from "./_components/automation-jobs-table";
import { ReportsTable } from "./_components/reports-table";

export const metadata = {
  title: "Reports · future-cmo",
};

export default async function ReportsListPage() {
  const user = await requireUser();
  const [rows, jobs] = await Promise.all([
    listReports(user.id),
    listAutomationJobsByUser(user.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label">— gm prospecting · reports</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Reports
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every audit you generate and every automation job is saved here —
            open one to view results without re-fetching from Google.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/gm-prospecting/automation"
            className={buttonVariants({ variant: "outline" })}
          >
            New automation
          </Link>
          <Link href="/gm-prospecting" className={buttonVariants()}>
            New search
          </Link>
        </div>
      </header>

      {/* Automation jobs (live status) */}
      {jobs.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-label">Automation jobs · {jobs.length}</h2>
          <div className="mt-3">
            <AutomationJobsTable
              jobs={jobs.map((j) => ({
                id: j.id,
                name: j.name,
                status: j.status as
                  | "queued"
                  | "running"
                  | "completed"
                  | "failed"
                  | "stopped",
                taskCount: (j.tasks as unknown[]).length,
                currentTaskIndex: j.currentTaskIndex,
                resultCount: (j.results as unknown[]).length,
                createdAt: j.createdAt.toISOString(),
                completedAt: j.completedAt ? j.completedAt.toISOString() : null,
              }))}
            />
          </div>
        </section>
      ) : null}

      {/* Saved reports */}
      <section className="mt-8">
        {rows.length > 0 ? <h2 className="text-label mb-3">Saved reports · {rows.length}</h2> : null}
        {rows.length === 0 && jobs.length === 0 ? (
          <EmptyState />
        ) : rows.length === 0 ? null : (
          <ReportsTable rows={rows} />
        )}
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border bg-card p-10 text-center">
      <h3 className="text-base font-medium">No reports yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Run a prospecting search, add a few businesses, and click Report to
        generate your first audit.
      </p>
      <p className="text-comment mt-3">
        {"// reports save automatically once you generate one"}
      </p>
      <Link
        href="/gm-prospecting"
        className={buttonVariants({ className: "mt-5" })}
      >
        Start prospecting
      </Link>
    </div>
  );
}
