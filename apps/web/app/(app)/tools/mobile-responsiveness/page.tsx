import { requireUser } from "@/lib/auth/session";

import { MobileResponsivenessTool } from "./_components/mobile-responsiveness-tool";

export const metadata = {
  title: "Mobile Responsiveness · future-cmo",
};

export default async function MobileResponsivenessPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— web & digital · website foundations</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Mobile Responsiveness
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Side-by-side device previews + a mobile-friendliness signals audit.
          Identify what to flag to your client — viewport configuration,
          responsive images, legacy plugins, accessibility blockers.
        </p>
      </header>

      <section className="mt-8">
        <MobileResponsivenessTool />
      </section>
    </div>
  );
}
