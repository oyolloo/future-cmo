import { requireUser } from "@/lib/auth/session";

import { ListingOptimizerTool } from "./_components/listing-optimizer-tool";

export const metadata = {
  title: "App Store Listing Optimizer · future-cmo",
};

export default async function ListingOptimizerPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— shopify · app store optimization</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Listing Optimizer
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          AI-powered audit of your Shopify App Store listing. Get section-by-section
          scores, copy-paste-ready rewrites for title / tagline / hook, keyword
          gaps, competitor insights, and a prioritized action list to boost installs.
        </p>
      </header>

      <section className="mt-8">
        <ListingOptimizerTool />
      </section>
    </div>
  );
}
