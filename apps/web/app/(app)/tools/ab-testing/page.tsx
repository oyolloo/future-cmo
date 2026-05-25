import { requireUser } from "@/lib/auth/session";

import { ABTestTool } from "./_components/ab-test-tool";

export const metadata = {
  title: "A/B Test Calculator · future-cmo",
};

export default async function ABTestingPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header>
        <p className="text-label">— cro · experimentation</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          A/B Test Calculator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Two tools in one — check if your test results are statistically
          significant, or plan how long a new test needs to run. Pure math,
          instant results, zero cost.
        </p>
      </header>

      <section className="mt-8">
        <ABTestTool />
      </section>
    </div>
  );
}
