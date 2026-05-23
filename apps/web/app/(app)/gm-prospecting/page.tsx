import { ProspectingTool } from "./_components/prospecting-tool";

export const metadata = {
  title: "GM Prospecting · future-cmo",
};

export default function GMProspectingPage() {
  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— gm prospecting · find local leads</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Find local leads, run audits.
        </h1>
        <p className="text-comment mt-2">
          // pull real businesses from Google Maps · score gaps · save prospects
        </p>
      </header>

      <div className="mt-10">
        <ProspectingTool />
      </div>
    </div>
  );
}
