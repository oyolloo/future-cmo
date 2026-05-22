import { requireUser } from "@/lib/auth/session";

import { LogoutButton } from "./_components/logout-button";

export const metadata = {
  title: "Dashboard · future-cmo",
};

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome, {user.username}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Signed in as {user.email}
          </p>
        </div>
        <LogoutButton />
      </header>

      <section className="rounded-lg border border-border bg-card p-8">
        <h2 className="text-lg font-medium">Your workspace is ready.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The marketing strategy tools are not wired up yet — that&apos;s next.
        </p>
      </section>
    </div>
  );
}
