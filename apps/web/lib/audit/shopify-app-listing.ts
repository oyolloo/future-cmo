import "server-only";

// ─── Types ────────────────────────────────────────────────────────────

export type AppListingData = {
  url: string;
  handle: string;
  name: string | null;
  tagline: string | null;
  description: string;
  rating: string | null;
  reviewCount: string | null;
  pricing: string[];
  categories: string[];
  screenshotCount: number;
  screenshots: string[];
  iconUrl: string | null;
  developerName: string | null;
  builtForShopify: boolean;
  wordCount: number;
  headings: string[];
};

export type ListingScrapeError =
  | { kind: "invalid_url" }
  | { kind: "fetch_failed"; message: string }
  | { kind: "not_found" }
  | { kind: "parse_failed"; message: string };

// ─── Scraper ──────────────────────────────────────────────────────────

/**
 * Fetch a Shopify App Store listing page and extract structured data
 * for the LLM optimizer. The App Store is server-rendered HTML with
 * good semantic markup — no headless browser needed.
 */
export async function scrapeAppListing(
  rawUrl: string,
): Promise<
  | { ok: true; data: AppListingData }
  | { ok: false; error: ListingScrapeError }
> {
  const url = normaliseUrl(rawUrl);
  if (!url) {
    return { ok: false, error: { kind: "invalid_url" } };
  }

  const handle = url.pathname.replace(/^\//, "").split("/")[0] ?? "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  let html: string;
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      cache: "no-store",
    });
    clearTimeout(timer);

    if (res.status === 404) {
      return { ok: false, error: { kind: "not_found" } };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: {
          kind: "fetch_failed",
          message: `HTTP ${res.status} ${res.statusText}`,
        },
      };
    }
    html = await res.text();
  } catch (err) {
    clearTimeout(timer);
    return {
      ok: false,
      error: {
        kind: "fetch_failed",
        message: err instanceof Error ? err.message : "Network error",
      },
    };
  }

  try {
    const data = parseListingHtml(url.toString(), handle, html);
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "parse_failed",
        message: err instanceof Error ? err.message : "Unknown parse error",
      },
    };
  }
}

// ─── Parser ──────────────────────────────────────────────────────────

function parseListingHtml(
  url: string,
  handle: string,
  html: string,
): AppListingData {
  const name = extractMeta(html, "og:title") ?? extractTitle(html);
  const tagline = extractMeta(html, "description") ?? extractMeta(html, "og:description");

  // Strip scripts/styles, then extract body text for full description.
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "");

  const bodyText = stripTags(cleaned).replace(/\s+/g, " ").trim();
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  // Rating
  const ratingMatch =
    /(\d+\.?\d*)\s*(?:out of 5 stars|\/\s*5)/i.exec(html) ??
    /data-rating=["'](\d+\.?\d*)["']/i.exec(html);
  const rating = ratingMatch?.[1] ?? null;

  // Review count
  const reviewMatch =
    /(\d[\d,]*)\s*reviews?/i.exec(html);
  const reviewCount = reviewMatch?.[1]?.replace(/,/g, "") ?? null;

  // Pricing — look for plan names + prices
  const priceMatches = html.matchAll(
    /\$[\d,.]+(?:\s*\/\s*(?:month|mo|year|yr))?/gi,
  );
  const pricing = [...new Set([...priceMatches].map((m) => m[0]))];

  // Also look for "Free", "Free plan available", etc.
  if (/\bfree\s+(?:plan|to install|to use)\b/i.test(html)) {
    pricing.unshift("Free plan available");
  }

  // Categories
  const categoryMatches = html.matchAll(
    /<a[^>]*href=["']\/categories\/([^"']+)["'][^>]*>([^<]+)/gi,
  );
  const categories = [...categoryMatches].map((m) =>
    stripTags(m[2] ?? "").trim(),
  ).filter(Boolean);

  // Screenshots — extract URLs + deduplicate
  const screenshotSet = new Map<string, string>();
  const imgRe = /(?:data-src|src)=["']([^"']+)["']/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRe.exec(html)) !== null) {
    const src = imgMatch[1];
    if (!src) continue;
    if (
      /screenshot|app-image|listing-image|gallery|media\/image/i.test(src) &&
      /\.(png|jpg|jpeg|webp|gif|avif)/i.test(src)
    ) {
      const abs = src.startsWith("//")
        ? `https:${src}`
        : src.startsWith("/")
          ? `https://apps.shopify.com${src}`
          : src;
      // Strip CDN resize params to get full-quality original
      const clean = abs.replace(/\?.*$/, "");
      const key = clean.replace(/_\d+x\d*/, "").replace(/_\d+x/, "");
      if (!screenshotSet.has(key)) screenshotSet.set(key, clean);
    }
  }
  const screenshotUrls = [...screenshotSet.values()];
  const screenshotCount = screenshotUrls.length;

  // App icon
  const iconRe =
    /(?:data-src|src)=["']([^"']*(?:app[_-]?icon|app[_-]?logo|icon\d*)[^"']*)["']/i;
  const iconMatch = iconRe.exec(html);
  let iconUrl: string | null = null;
  if (!iconMatch) {
    const ogImg = extractMeta(html, "og:image");
    if (ogImg) iconUrl = ogImg;
  } else {
    const raw = iconMatch[1] ?? "";
    iconUrl = raw.startsWith("//")
      ? `https:${raw}`
      : raw.startsWith("/")
        ? `https://apps.shopify.com${raw}`
        : raw;
  }

  // Developer name
  const devMatch =
    /<a[^>]*class=["'][^"']*(?:developer|partner)["'][^>]*>([^<]+)/i.exec(html) ??
    /by\s+<[^>]+>([^<]+)/i.exec(html);
  const developerName = devMatch?.[1]?.trim() ?? null;

  // Built for Shopify badge
  const builtForShopify =
    /built\s+for\s+shopify/i.test(html);

  // Headings
  const headings: string[] = [];
  const headingRe = /<h[1-4][^>]*>([^<]+)/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headingRe.exec(html)) !== null) {
    const t = hm[1]?.trim();
    if (t && t.length > 2 && t.length < 200) headings.push(t);
  }

  return {
    url,
    handle,
    name,
    tagline,
    description: bodyText.slice(0, 15_000),
    rating,
    reviewCount,
    pricing,
    categories,
    screenshotCount,
    screenshots: screenshotUrls,
    iconUrl,
    developerName,
    builtForShopify,
    wordCount,
    headings,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function normaliseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Accept "apps.shopify.com/myapp" without scheme.
  const withScheme =
    /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname.includes("apps.shopify.com")) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([^<]+)/i.exec(html);
  return m?.[1]?.trim() ?? null;
}

function extractMeta(html: string, nameOrProp: string): string | null {
  const re = new RegExp(
    `<meta[^>]*(?:name|property)=["']${nameOrProp}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${nameOrProp}["']`,
    "i",
  );
  return (re.exec(html)?.[1] ?? re2.exec(html)?.[1])?.trim() ?? null;
}

function stripTags(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
