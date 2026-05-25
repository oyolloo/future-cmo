import { requireUser } from "@/lib/auth/session";

import { DomainHostingTool } from "./_components/domain-hosting-tool";

export const metadata = {
  title: "Domain & Hosting · future-cmo",
};

export default async function DomainHostingPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— web & digital · website foundations</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Domain &amp; Hosting
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Registrar, expiry date, hosting provider, server location, DNS
          records, and email security — everything you need to qualify a
          prospect or audit your own setup.
        </p>
      </header>

      <section className="mt-8">
        <DomainHostingTool />
      </section>
    </div>
  );
}
