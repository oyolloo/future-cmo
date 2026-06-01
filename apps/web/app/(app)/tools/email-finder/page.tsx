import { requireUser } from "@/lib/auth/session";

import { EmailFinderTool } from "./_components/email-finder-tool";

export const metadata = {
  title: "Email Finder · future-cmo",
};

export default async function EmailFinderPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— utilities · email finder</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Email Finder
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {`Enter any website URL — we'll scan the homepage plus common
          contact, about, and team pages to extract every email address
          we can find.`}
        </p>
      </header>

      <section className="mt-8">
        <EmailFinderTool />
      </section>
    </div>
  );
}
