import { requireUser } from "@/lib/auth/session";

import { CompanyFinderTool } from "./_components/company-finder-tool";

export const metadata = {
  title: "Company Finder · future-cmo",
};

export default async function CompanyFinderPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— utilities · company finder</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Company Finder
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {`Enter a domain — we scrape the homepage, contact, and about pages,
          parse structured data (JSON-LD, OpenGraph), extract emails, social
          profiles, key people, and score how confidently each social handle
          matches the brand.`}
        </p>
      </header>

      <section className="mt-8">
        <CompanyFinderTool />
      </section>
    </div>
  );
}
