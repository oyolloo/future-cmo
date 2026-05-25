import { requireUser } from "@/lib/auth/session";

import { CmsDetectorTool } from "./_components/cms-detector-tool";

export const metadata = {
  title: "CMS Detector · future-cmo",
};

export default async function CmsDetectorPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— web & digital · website foundations</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          CMS Detector
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Identify the complete tech stack behind any website — CMS, e-commerce
          platform, JavaScript frameworks, analytics, CDN, hosting, payment
          processors, fonts, marketing tools, and more.
        </p>
      </header>

      <section className="mt-8">
        <CmsDetectorTool />
      </section>
    </div>
  );
}
