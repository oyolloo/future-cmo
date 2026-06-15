import { requireUser } from "@/lib/auth/session";

import { SocialLinksTool } from "./_components/social-links-tool";

export const metadata = {
  title: "Social Links Finder · future-cmo",
};

export default async function SocialLinksPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header>
        <p className="text-label">— utilities · social links finder</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Social Links Finder
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter a website URL — we crawl the homepage, /contact, and /about
          pages to extract social media profile links. Supports Facebook,
          Instagram, Twitter/X, LinkedIn, YouTube, TikTok, Pinterest, GitHub,
          Threads, Snapchat, and Discord.
        </p>
      </header>

      <section className="mt-8">
        <SocialLinksTool />
      </section>
    </div>
  );
}
