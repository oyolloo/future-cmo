import { requireUser } from "@/lib/auth/session";

import { WebsiteSpeedTool } from "./_components/website-speed-tool";

export const metadata = {
  title: "Website Speed · future-cmo",
};

export default async function WebsiteSpeedPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— web & digital · website foundations</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Website Speed
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Lab + field performance signals from Google PageSpeed Insights —
          Core Web Vitals, top opportunities, and Lighthouse diagnostics.
        </p>
      </header>

      <section className="mt-8">
        <WebsiteSpeedTool />
      </section>
    </div>
  );
}
