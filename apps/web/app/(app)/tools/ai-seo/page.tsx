import { requireUser } from "@/lib/auth/session";

import { AISeoTool } from "./_components/ai-seo-tool";

export const metadata = {
  title: "AI SEO · future-cmo",
};

export default async function AISeoPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— advanced seo · generative engine optimization</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          AI SEO
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Audit a page for AI-search citability — ChatGPT, Claude, Perplexity,
          Gemini, Bing Copilot. Schema markup · content structure · AI-bot
          access · brand entity signals · LLM-graded verdict.
        </p>
      </header>

      <section className="mt-8">
        <AISeoTool />
      </section>
    </div>
  );
}
