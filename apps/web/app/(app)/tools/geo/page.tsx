import { requireUser } from "@/lib/auth/session";

import { GeoTool } from "./_components/geo-tool";

export const metadata = {
  title: "GEO · future-cmo",
};

export default async function GeoPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— advanced seo · generative engine optimization</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          GEO
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Generative Engine Optimization — simulate real user queries against
          ChatGPT / Perplexity / Gemini / Claude and grade how likely each
          engine is to <em>cite this page</em> when answering. See exactly
          what&apos;s missing per query, plus a sample snippet of what AI
          would quote if it cited the page today.
        </p>
      </header>

      <section className="mt-8">
        <GeoTool />
      </section>
    </div>
  );
}
