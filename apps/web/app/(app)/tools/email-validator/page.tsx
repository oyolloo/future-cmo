import { requireUser } from "@/lib/auth/session";

import { EmailValidatorTool } from "./_components/email-validator-tool";

export const metadata = {
  title: "Email Validator · future-cmo",
};

export default async function EmailValidatorPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— utilities · email validator</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Email Validator
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste any text or a comma-separated list — extract and validate
          every email address. Catch typos, duplicates, and bad formats
          before you send.
        </p>
      </header>

      <section className="mt-8">
        <EmailValidatorTool />
      </section>
    </div>
  );
}
