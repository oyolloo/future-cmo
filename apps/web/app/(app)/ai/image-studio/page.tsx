import { requireUser } from "@/lib/auth/session";

import { ImageStudioTool } from "./_components/image-studio-tool";

export const metadata = {
  title: "Image Studio · future-cmo",
};

export default async function ImageStudioPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— ai tools · image studio</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Image Studio
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Analyze marketing images with AI vision — get design critique,
          improvement suggestions, and generate new versions with a single
          click.
        </p>
      </header>

      <section className="mt-8">
        <ImageStudioTool />
      </section>
    </div>
  );
}
