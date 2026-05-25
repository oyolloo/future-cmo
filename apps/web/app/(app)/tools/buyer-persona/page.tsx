import Link from "next/link";

import { listSavedPersonas } from "@kit/database";

import { requireUser } from "@/lib/auth/session";

import { PersonaTool } from "./_components/persona-tool";

export const metadata = {
  title: "Buyer Persona Generator · future-cmo",
};

export default async function BuyerPersonaPage() {
  const user = await requireUser();
  const saved = await listSavedPersonas(user.id);

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— marketing strategy · audience research</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Buyer Persona Generator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Describe your business + target market → get 3 detailed, actionable
          buyer personas with demographics, pain points, messaging hooks,
          and channel recommendations. Auto-saved to your persona library.
        </p>
      </header>

      <section className="mt-8">
        <PersonaTool />
      </section>

      {saved.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-label">Saved personas · {saved.length}</h2>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {saved.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {s.name}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-muted-foreground">
                    {s.businessType} · {s.targetMarket}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-[0.625rem] text-muted-foreground">
                  {s.createdAt.toISOString().slice(0, 10)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
