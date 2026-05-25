import { requireUser } from "@/lib/auth/session";

import { SemanticSeoTool } from "./_components/semantic-seo-tool";

export const metadata = {
  title: "Semantic SEO · future-cmo",
};

export default async function SemanticSeoPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— advanced seo · topical authority</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Semantic SEO
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Audit a page for entity coverage + topical depth. Modern search
          ranks pages by how comprehensively they cover a topic&apos;s related
          entities — not by keyword density.
        </p>
      </header>

      <section className="mt-8">
        <SemanticSeoTool />
      </section>
    </div>
  );
}
