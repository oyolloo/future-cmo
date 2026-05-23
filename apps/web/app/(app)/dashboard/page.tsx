import { requireUser } from "@/lib/auth/session";

export const metadata = {
  title: "Dashboard · future-cmo",
};

type Stat = {
  label: string;
  value: string;
  meta: string;
};

const stats: Stat[] = [
  { label: "Active strategies", value: "—", meta: "0 in flight" },
  { label: "Campaigns", value: "—", meta: "no campaigns yet" },
  { label: "AI insights", value: "—", meta: "Claude not wired" },
  { label: "Content queue", value: "—", meta: "draft to publish" },
];

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      {/* heading */}
      <header>
        <p className="text-label">— workspace · core</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Welcome back,{" "}
          <span className="text-primary">{user.username}</span>.
        </h1>
        <p className="text-comment mt-2">
          // strategy desk · content calendar · claude — all wiring up next
        </p>
      </header>

      {/* stat cards */}
      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, idx) => (
          <div
            key={stat.label}
            className="relative rounded-lg border border-border bg-card p-6"
          >
            <span className="stat-badge absolute right-4 top-4">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <p className="text-label">{stat.label}</p>
            <p className="num-display mt-4 text-4xl font-semibold tracking-tight">
              {stat.value}
            </p>
            <p className="text-comment mt-3">{stat.meta}</p>
          </div>
        ))}
      </section>

      {/* getting started panel */}
      <section className="mt-10">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-sm bg-primary" />
            <h2 className="text-base font-medium">Getting started</h2>
          </div>
          <span className="text-comment">// what&apos;s next</span>
        </div>

        <div className="rounded-lg border border-border bg-card p-8">
          <p className="text-sm text-foreground">
            Your workspace is ready. The strategy desk, content calendar, and
            Claude integration are not wired up yet — that&apos;s the next phase.
          </p>
          <p className="text-comment mt-2">
            // see docs/docs.md for the build roadmap
          </p>
        </div>
      </section>
    </div>
  );
}
