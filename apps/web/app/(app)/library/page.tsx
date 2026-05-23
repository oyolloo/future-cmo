import Link from "next/link";

import { loadPillars, type PillarSummary } from "./_lib/loader";

export const metadata = {
  title: "Library · future-cmo",
};

export default async function LibraryPage() {
  const pillars = await loadPillars();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— taxonomy · the future cmo</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Library
        </h1>
        <p className="text-comment mt-2">
          // 30+ pillars · 75+ sub-pillars · 240+ topics
        </p>
      </header>

      {pillars.length === 0 ? <EmptyState /> : <PillarGrid pillars={pillars} />}
    </div>
  );
}

function EmptyState() {
  return (
    <section className="mt-12 rounded-lg border border-border bg-card p-10">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-sm bg-primary" />
        <h2 className="text-base font-medium">Taxonomy not seeded yet</h2>
      </div>

      <p className="mt-4 text-sm text-foreground">
        Drop your exported sheet into the repo, then run the seed script.
      </p>

      <div className="mt-6 rounded-md border border-border bg-background p-4">
        <p className="text-label mb-2">expected CSV format</p>
        <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-muted-foreground">
{`pillar,sub_pillar,topic
Fundamentals,Marketing Basics,What is Digital Marketing
Fundamentals,Marketing Basics,Marketing Funnel
Fundamentals,Branding,Brand Positioning
SEO,Keyword Research,Search Volume
SEO,Keyword Research,Keyword Difficulty
...`}
        </pre>
      </div>

      <ol className="mt-6 space-y-2 text-sm text-muted-foreground">
        <li>
          <span className="text-label mr-2">01</span>
          Google Sheet &raquo; File &raquo; Download &raquo; CSV.
        </li>
        <li>
          <span className="text-label mr-2">02</span>
          Save as{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            packages/database/data/taxonomy.csv
          </code>
        </li>
        <li>
          <span className="text-label mr-2">03</span>
          Run{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            pnpm db:seed:taxonomy
          </code>{" "}
          <span className="text-muted-foreground/60">(coming next)</span>
        </li>
      </ol>

      <p className="text-comment mt-6">
        // the seed script is the next thing on deck
      </p>
    </section>
  );
}

function PillarGrid({ pillars }: { pillars: PillarSummary[] }) {
  return (
    <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {pillars.map((pillar, idx) => (
        <Link
          key={pillar.id}
          href={`/library/${pillar.slug}`}
          className="group relative rounded-lg border border-border bg-card p-6 transition-colors hover:border-primary/40 hover:bg-card/80"
        >
          <span className="stat-badge absolute right-4 top-4">
            {String(idx + 1).padStart(2, "0")}
          </span>
          <h3 className="text-lg font-medium tracking-tight group-hover:text-primary">
            {pillar.name}
          </h3>
          {pillar.description ? (
            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
              {pillar.description}
            </p>
          ) : null}
          <p className="text-comment mt-4">
            // {pillar.subPillarCount} sub-pillars · {pillar.topicCount} topics
          </p>
        </Link>
      ))}
    </section>
  );
}
