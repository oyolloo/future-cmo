import Link from "next/link";

import { buttonVariants } from "@kit/ui/button";

export default function LandingPage() {
  return (
    <main className="relative isolate flex min-h-screen flex-col">
      {/* subtle radial glow behind the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[800px] bg-[radial-gradient(60%_60%_at_50%_0%,oklch(0.70_0.16_50/0.18),transparent_70%)]"
      />

      {/* top bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-sm bg-primary" />
          <span className="font-mono text-sm tracking-tight">future-cmo</span>
          <span className="ml-1 rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            v 0.1 · alpha
          </span>
        </div>

        <nav className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            sign in
          </Link>
          <Link href="/sign-up" className={buttonVariants({ size: "sm" })}>
            Get started
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-start justify-center px-6 py-16">
        <p className="text-label mb-6">— workspace · core</p>

        <h1 className="max-w-3xl text-5xl font-semibold tracking-tight sm:text-6xl">
          The marketing strategy desk,{" "}
          <span className="text-primary">rebuilt for AI-first teams.</span>
        </h1>

        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          Plan campaigns, draft content, and synthesize research with Claude
          built in. One workspace for strategy, briefs, and execution — without
          the spreadsheet sprawl.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/sign-up" className={buttonVariants({ size: "lg" })}>
            + Create account
          </Link>
          <Link
            href="/sign-in"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Sign in
          </Link>
          <span className="text-comment ml-2">
            // no credit card · seconds to start
          </span>
        </div>

        {/* feature row */}
        <div className="mt-20 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
          {features.map((feature, idx) => (
            <div
              key={feature.title}
              className="relative rounded-lg border border-border bg-card p-6"
            >
              <span className="stat-badge absolute right-4 top-4">
                {String(idx + 1).padStart(2, "0")}
              </span>
              <p className="text-label">{feature.label}</p>
              <h3 className="mt-3 text-lg font-medium">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {feature.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl border-t border-border px-6 py-6">
        <p className="text-comment">
          // future-cmo · built with Next.js · powered by Claude
        </p>
      </footer>
    </main>
  );
}

const features = [
  {
    label: "Strategy",
    title: "AI-drafted briefs",
    body: "Generate campaign briefs and positioning from a single prompt. Edit, version, ship.",
  },
  {
    label: "Content",
    title: "Calendar that thinks",
    body: "Ideas, drafts, and schedules in one place — with Claude proposing what's next.",
  },
  {
    label: "Signal",
    title: "Performance, demystified",
    body: "Pull metrics from your stack, get plain-English readouts on what's working.",
  },
];
