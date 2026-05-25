import Link from "next/link";

import { buttonVariants } from "@kit/ui/button";

import { requireUser } from "@/lib/auth/session";
import { listReports } from "@/lib/reports/service";

import { ReportsTable } from "./_components/reports-table";

export const metadata = {
  title: "Reports · future-cmo",
};

export default async function ReportsListPage() {
  const user = await requireUser();
  const rows = await listReports(user.id);

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-label">— gm prospecting · reports</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Reports
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every audit you generate is saved here — open one to view without
            re-fetching from Google.
          </p>
        </div>
        <Link href="/gm-prospecting" className={buttonVariants()}>
          New search
        </Link>
      </header>

      <section className="mt-8">
        {rows.length === 0 ? (
          <EmptyState />
        ) : (
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
