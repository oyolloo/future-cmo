import { requireUser } from "@/lib/auth/session";

import { EntitySeoTool } from "./_components/entity-seo-tool";

export const metadata = {
  title: "Entity SEO · future-cmo",
};

export default async function EntitySeoPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— advanced seo · knowledge graph alignment</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Entity SEO
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Audit how the page handles its named entities — brands, people,
          products, places. Are they disambiguated, linked to authoritative
          sources, and marked up with schema so Google + LLMs build a strong
          knowledge graph connection?
        </p>
      </header>

      <section className="mt-8">
        <EntitySeoTool />
      </section>
    </div>
  );
}
