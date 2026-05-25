import { requireUser } from "@/lib/auth/session";

import { FunnelTool } from "./_components/funnel-tool";

export const metadata = {
  title: "Marketing Funnel Calculator · future-cmo",
};

export default async function MarketingFunnelPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header>
        <p className="text-label">— marketing strategy · funnel analysis</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Marketing Funnel
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter numbers at each stage of your funnel — see conversion rates,
          drop-off points, and where the biggest bottleneck is. Works for any
          funnel: website → lead → trial → paid, or install → setup → active →
          retained.
        </p>
      </header>

      <section className="mt-8">
        <FunnelTool />
      </section>
    </div>
  );
}
