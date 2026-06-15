"use server";

import { requireUser } from "@/lib/auth/session";
import { extractSocialLinks } from "@/lib/intel/social-extractor";
import { handleFromSocialUrl } from "@/lib/intel/handle-similarity";

export type SocialLinkResult = {
  platform: string;
  url: string;
  handle: string | null;
  source: "scrape" | "google" | "schema";
};

export type SocialLinksData = {
  domain: string;
  links: SocialLinkResult[];
  pagesScanned: string[];
  googleSearched: boolean;
  durationMs: number;
};

const QUICK_PAGES = ["", "/contact", "/about", "/about-us"];
const DEEP_PAGES = [
  ...QUICK_PAGES,
  "/connect", "/links", "/social", "/social-media",
  "/follow", "/follow-us",
];

const SEARCH_PLATFORMS = [
  { platform: "facebook", site: "facebook.com" },
  { platform: "instagram", site: "instagram.com" },
  { platform: "twitter", site: "twitter.com OR site:x.com" },
  { platform: "linkedin", site: "linkedin.com" },
  { platform: "youtube", site: "youtube.com" },
  { platform: "tiktok", site: "tiktok.com" },
  { platform: "pinterest", site: "pinterest.com" },
  { platform: "github", site: "github.com" },
];

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

async function searchGoogle(query: string): Promise<string | null> {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10&hl=en`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

function extractUrlsFromGoogleHtml(html: string, platformSite: string): string[] {
  const urls: string[] = [];
  const siteDomain = platformSite.split(" OR ")[0]!;

  // Google wraps result links as /url?q=ENCODED_URL
  const redirectRe = /\/url\?q=(https?[^&"]+)/gi;
  let m;
  while ((m = redirectRe.exec(html)) !== null) {
    try {
      const decoded = decodeURIComponent(m[1]!);
      if (decoded.includes(siteDomain) || (platformSite.includes("x.com") && decoded.includes("x.com"))) {
        urls.push(decoded);
      }
    } catch { /* skip */ }
  }

  // Also scan for direct href links to the platform
  const hrefRe = /href="(https?:\/\/[^"]+)"/gi;
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1]!;
    if (href.includes(siteDomain) || (platformSite.includes("x.com") && href.includes("x.com"))) {
      urls.push(href);
    }
  }

  return urls;
}

async function googleSearchSocials(
  domain: string,
): Promise<SocialLinkResult[]> {
  const results: SocialLinkResult[] = [];
  const seenPlatforms = new Set<string>();

  // Run searches in parallel batches of 3 to avoid rate-limiting
  for (let i = 0; i < SEARCH_PLATFORMS.length; i += 3) {
    const batch = SEARCH_PLATFORMS.slice(i, i + 3);
    const htmlResults = await Promise.all(
      batch.map((p) =>
        searchGoogle(`site:${p.site} "${domain}"`).then((html) => ({
          ...p,
          html,
        })),
      ),
    );

    for (const { platform, site, html } of htmlResults) {
      if (!html || seenPlatforms.has(platform)) continue;
      const urls = extractUrlsFromGoogleHtml(html, site);

      // Find the first URL that looks like a profile
      for (const rawUrl of urls) {
        const found = extractSocialLinks(
          `<a href="${rawUrl.replace(/"/g, "&quot;")}">x</a>`,
        );
        if (found.length > 0 && found[0]!.platform === platform) {
          seenPlatforms.add(platform);
          results.push({
            platform: found[0]!.platform,
            url: found[0]!.url,
            handle: handleFromSocialUrl(found[0]!.url),
            source: "google",
          });
          break;
        }
      }
    }

    // Small delay between batches
    if (i + 3 < SEARCH_PLATFORMS.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  return results;
}

export async function findSocialLinksAction(
  rawUrl: string,
  options: { deep?: boolean } = {},
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

  const deep = options.deep ?? false;
  const pages = deep ? DEEP_PAGES : QUICK_PAGES;

  const seenPlatforms = new Set<string>();
  const allLinks: SocialLinkResult[] = [];
  const pagesScanned: string[] = [];

  function addLink(link: SocialLinkResult) {
    if (seenPlatforms.has(link.platform)) return;
    seenPlatforms.add(link.platform);
    allLinks.push(link);
  }

  // 1) Scrape website pages
  for (const suffix of pages) {
    const pageUrl = base + suffix;
    const html = await fetchPage(pageUrl);
    if (!html) continue;
    pagesScanned.push(pageUrl);

    const found = extractSocialLinks(html);
    for (const link of found) {
      addLink({
        platform: link.platform,
        url: link.url,
        handle: handleFromSocialUrl(link.url),
        source: "scrape",
      });
    }
  }

  // 2) Deep mode: Google search for missing platforms
  let googleSearched = false;
  if (deep) {
    googleSearched = true;
    const googleResults = await googleSearchSocials(domain);
    for (const link of googleResults) {
      addLink(link);
    }
  }

  return {
    ok: true,
    data: {
      domain,
      links: allLinks,
      pagesScanned,
      googleSearched,
      durationMs: Date.now() - start,
    },
  };
}
