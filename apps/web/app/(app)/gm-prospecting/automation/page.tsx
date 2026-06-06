import { requireUser } from "@/lib/auth/session";

import { AutomationTool } from "./_components/automation-tool";

export const metadata = {
  title: "GM Prospecting Automation · future-cmo",
};

export default async function AutomationPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— lead generate · gm prospecting · automation</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Prospecting Automation
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {`Queue multiple keyword + location searches. Set a delay between
          tasks, run them in sequence, and export every result as a single
          CSV — opens cleanly in Excel, Google Sheets, or Numbers.`}
        </p>
      </header>

      <section className="mt-8">
        <AutomationTool />
      </section>
    </div>
  );
}
