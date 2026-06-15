"use server";

import { requireUser } from "@/lib/auth/session";
import { extractSocialLinks } from "@/lib/intel/social-extractor";
import { handleFromSocialUrl } from "@/lib/intel/handle-similarity";

export type SocialLinkResult = {
  platform: string;
  url: string;
  handle: string | null;
  source: "scrape" | "search" | "probe";
};

export type SocialLinksData = {
  domain: string;
  links: SocialLinkResult[];
  pagesScanned: string[];
  deepSearched: boolean;
  durationMs: number;
};

const QUICK_PAGES = ["", "/contact", "/about", "/about-us"];
const DEEP_PAGES = [
  ...QUICK_PAGES,
  "/connect", "/links", "/social", "/follow-us",
];

const SEARCH_PLATFORMS = [
  { platform: "facebook", site: "facebook.com" },
  { platform: "instagram", site: "instagram.com" },
  { platform: "twitter", site: "twitter.com" },
  { platform: "linkedin", site: "linkedin.com" },
  { platform: "youtube", site: "youtube.com" },
  { platform: "tiktok", site: "tiktok.com" },
  { platform: "pinterest", site: "pinterest.com" },
  { platform: "github", site: "github.com" },
];

const PROBE_TEMPLATES: Record<string, (u: string) => string> = {
  facebook: (u) => `https://www.facebook.com/${u}/`,
  instagram: (u) => `https://www.instagram.com/${u}/`,
  twitter: (u) => `https://x.com/${u}`,
  linkedin: (u) => `https://www.linkedin.com/company/${u}`,
  youtube: (u) => `https://www.youtube.com/@${u}`,
  tiktok: (u) => `https://www.tiktok.com/@${u}`,
  github: (u) => `https://github.com/${u}`,
  pinterest: (u) => `https://www.pinterest.com/${u}/`,
};

// ─── Fetchers ───────────────────────────────────────────────────────

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

// ─── DuckDuckGo Search ──────────────────────────────────────────────

async function searchDDG(query: string): Promise<string[]> {
  try {
    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      },
      body: `q=${encodeURIComponent(query)}&b=`,
      signal: AbortSignal.timeout(10_000),
      redirect: "follow",
    });
    if (!res.ok) return [];
    const html = await res.text();

    const urls: string[] = [];
    // DDG wraps result URLs in /l/?uddg=ENCODED_URL
    const uddgRe = /uddg=(https?[^&"]+)/gi;
    let m;
    while ((m = uddgRe.exec(html)) !== null) {
      try {
        urls.push(decodeURIComponent(m[1]!));
      } catch { /* skip */ }
    }
    // Also grab any direct hrefs to social platforms
    const hrefRe = /href="(https?:\/\/(?!duckduckgo\.com)[^"]+)"/gi;
    while ((m = hrefRe.exec(html)) !== null) {
      urls.push(m[1]!);
    }
    return urls;
  } catch {
    return [];
  }
}

async function searchSocials(
  domain: string,
  skip: Set<string>,
): Promise<SocialLinkResult[]> {
  const results: SocialLinkResult[] = [];
  const toSearch = SEARCH_PLATFORMS.filter((p) => !skip.has(p.platform));

  // Batch 3 at a time to avoid rate-limiting
  for (let i = 0; i < toSearch.length; i += 3) {
    const batch = toSearch.slice(i, i + 3);
    const batchResults = await Promise.all(
      batch.map(async (p) => {
        const urls = await searchDDG(`site:${p.site} "${domain}"`);
        return { ...p, urls };
      }),
    );

    for (const { platform, urls } of batchResults) {
      if (skip.has(platform)) continue;
      for (const rawUrl of urls) {
        const fakeHtml = `<a href="${rawUrl.replace(/"/g, "&quot;")}">x</a>`;
        const found = extractSocialLinks(fakeHtml);
        if (found.length > 0 && found[0]!.platform === platform) {
          skip.add(platform);
          results.push({
            platform: found[0]!.platform,
            url: found[0]!.url,
            handle: handleFromSocialUrl(found[0]!.url),
            source: "search",
          });
          break;
        }
      }
    }

    if (i + 3 < toSearch.length) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return results;
}

// ─── Profile probing ────────────────────────────────────────────────

async function probeProfile(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      redirect: "follow",
    });
    if (!res.ok) return false;
    const html = await res.text();
    // Reject generic error/login pages
    if (/page not found|this page isn.t available|404|content is not available/i.test(html.slice(0, 5000))) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function probeSocials(
  usernames: string[],
  skip: Set<string>,
): Promise<SocialLinkResult[]> {
  const results: SocialLinkResult[] = [];
  const platforms = Object.entries(PROBE_TEMPLATES).filter(
    ([p]) => !skip.has(p),
  );

  for (const username of usernames) {
    if (platforms.length === 0) break;
    const remaining = platforms.filter(([p]) => !skip.has(p));

    const probes = await Promise.all(
      remaining.map(async ([platform, makeUrl]) => {
        const url = makeUrl(username);
        const exists = await probeProfile(url);
        return { platform, url, exists };
      }),
    );

    for (const { platform, url, exists } of probes) {
      if (!exists || skip.has(platform)) continue;
      skip.add(platform);
      results.push({
        platform,
        url: url.replace(/\/+$/, ""),
        handle: handleFromSocialUrl(url),
        source: "probe",
      });
    }
  }

  return results;
}

// ─── Main action ────────────────────────────────────────────────────

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

  // Step 1: Scrape website pages
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

  // Step 2 (deep): Search DuckDuckGo for missing platforms
  if (deep) {
    const searchResults = await searchSocials(domain, new Set(seenPlatforms));
    for (const link of searchResults) addLink(link);
  }

  // Step 3 (deep): Probe direct profile URLs using domain name + found handles
  if (deep) {
    const candidates = new Set<string>();
    // Domain name without TLD as username candidate
    const domainName = domain.split(".")[0];
    if (domainName && domainName.length >= 2) candidates.add(domainName);
    // Collect handles already found (they might exist on other platforms too)
    for (const link of allLinks) {
      if (link.handle) candidates.add(link.handle);
    }
    const probeResults = await probeSocials(
      [...candidates],
      new Set(seenPlatforms),
    );
    for (const link of probeResults) addLink(link);
  }

  return {
    ok: true,
    data: {
      domain,
      links: allLinks,
      pagesScanned,
      deepSearched: deep,
      durationMs: Date.now() - start,
    },
  };
}
