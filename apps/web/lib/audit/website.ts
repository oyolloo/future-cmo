import "server-only";

import type { SeoSignals } from "@kit/database";

/**
 * Fetch the HTML for a URL with a short timeout. Returns null on any
 * failure (network, timeout, non-2xx) so the rest of the audit pipeline
 * can continue.
 */
export async function fetchHtml(
  url: string,
  timeoutMs = 6000,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; future-cmo-audit/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Regex-based tech stack detector. Catches the heavy-hitters local-services
 * websites tend to use — CMSs, e-commerce platforms, analytics, marketing
 * pixels, and modern frameworks. Not exhaustive on purpose; we'd rather miss
 * a long-tail tool than mis-detect.
 */
export function detectTechnoStack(html: string): string[] {
  const detected: string[] = [];
  const tests: Array<[string, RegExp]> = [
    // CMS / site builders
    [
      "WordPress",
      /(\/wp-content\/|\/wp-includes\/|name=["']generator["']\s+content=["']WordPress)/i,
    ],
    ["Shopify", /(cdn\.shopify\.com|Shopify\.theme|Shopify\.routes)/],
    ["Wix", /(static\.wixstatic\.com|wix\.com\/wix)/i],
    ["Squarespace", /(squarespace\.com|static1\.squarespace)/i],
    ["Webflow", /(webflow|assets-global\.website-files)/i],
    ["Joomla", /name=["']generator["']\s+content=["']Joomla/i],
    ["Drupal", /Drupal\.settings/],
    ["Ghost", /name=["']generator["']\s+content=["']Ghost/i],
    ["Magento", /Mage\.Cookies|magento/i],
    ["WooCommerce", /wp-content\/plugins\/woocommerce/i],
    ["BigCommerce", /cdn11\.bigcommerce\.com/],
    // Analytics
    [
      "Google Analytics",
      /(googletagmanager\.com\/gtag\/js|google-analytics\.com|gtag\()/,
    ],
    [
      "Google Tag Manager",
      /(googletagmanager\.com\/gtm\.js|GTM-[A-Z0-9]+)/,
    ],
    [
      "Meta Pixel",
      /(connect\.facebook\.net\/[\w-]+\/fbevents\.js|fbq\()/,
    ],
    ["LinkedIn Insight", /snap\.licdn\.com\/li\.lms-analytics/],
    ["Hotjar", /static\.hotjar\.com|hjBootstrap/],
    ["Mixpanel", /cdn\.mxpnl\.com/],
    // Frameworks (presence ≈ modern build)
    ["Next.js", /(__NEXT_DATA__|\/_next\/static)/],
    ["React", /data-reactroot|react-dom/],
    ["Nuxt.js", /__NUXT__/],
    // Other SEO/structured signals
    ["Schema.org JSON-LD", /application\/ld\+json/],
    ["Cloudflare", /cf-ray|cloudflare\.com\/cdn/i],
  ];

  for (const [name, pattern] of tests) {
    if (pattern.test(html)) detected.push(name);
  }
  return detected;
}

/**
 * Probe basic on-page SEO signals from raw HTML. We do **not** parse the
 * full DOM (expensive on the server) — regex-based extraction is enough
 * for "is this set / is the length sensible" yes/no questions.
 */
export function analyzeSEO(html: string): SeoSignals {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = (titleMatch?.[1] ?? "").trim();

  const descMatch =
    /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(
      html,
    ) ??
    /<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(
      html,
    );
  const description = (descMatch?.[1] ?? "").trim();

  const hasH1 = /<h1[\s>]/i.test(html);
  const hasOpenGraph = /<meta\s+[^>]*property=["']og:(title|image)["']/i.test(
    html,
  );
  const hasStructuredData = /application\/ld\+json/i.test(html);

  return {
    hasTitle: title.length > 0,
    titleLength: title.length,
    hasMetaDescription: description.length > 0,
    metaDescriptionLength: description.length,
    hasH1,
    hasOpenGraph,
    hasStructuredData,
  };
}
