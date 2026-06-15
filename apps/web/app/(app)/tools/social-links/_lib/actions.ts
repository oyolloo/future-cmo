"use server";

import { requireUser } from "@/lib/auth/session";
import { extractSocialLinks } from "@/lib/intel/social-extractor";
import { handleFromSocialUrl } from "@/lib/intel/handle-similarity";

export type SocialLinkResult = {
  platform: string;
  url: string;
  handle: string | null;
};

export type SocialLinksData = {
  domain: string;
  links: SocialLinkResult[];
  pagesScanned: string[];
  durationMs: number;
};

const PAGES = ["", "/contact", "/about", "/about-us"];

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; FutureCMO/1.0; +https://futurecmo.oyolloo.com)",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("html")) return null;
    return res.text();
  } catch {
    return null;
  }
}

export async function findSocialLinksAction(
  rawUrl: string,
): Promise<
  | { ok: true; data: SocialLinksData }
  | { ok: false; error: { message: string } }
> {
  await requireUser();

  const start = Date.now();
  let base = rawUrl.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) base = `https://${base}`;

  let domain: string;
  try {
    domain = new URL(base).hostname.replace(/^www\./, "");
  } catch {
    return { ok: false, error: { message: "Invalid URL" } };
  }

  const seenPlatforms = new Set<string>();
  const allLinks: SocialLinkResult[] = [];
  const pagesScanned: string[] = [];

  for (const suffix of PAGES) {
    const pageUrl = base + suffix;
    const html = await fetchPage(pageUrl);
    if (!html) continue;
    pagesScanned.push(pageUrl);

    const found = extractSocialLinks(html);
    for (const link of found) {
      if (seenPlatforms.has(link.platform)) continue;
      seenPlatforms.add(link.platform);
      allLinks.push({
        platform: link.platform,
        url: link.url,
        handle: handleFromSocialUrl(link.url),
      });
    }
  }

  return {
    ok: true,
    data: {
      domain,
      links: allLinks,
      pagesScanned,
      durationMs: Date.now() - start,
    },
  };
}
