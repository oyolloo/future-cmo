import "server-only";

export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "pinterest"
  | "github"
  | "threads"
  | "snapchat"
  | "discord";

export type SocialLink = {
  platform: SocialPlatform;
  url: string;
};

const PATTERNS: Array<{ platform: SocialPlatform; host: RegExp }> = [
  { platform: "facebook", host: /(?:^|\.)(facebook|fb)\.com$/i },
  { platform: "instagram", host: /(?:^|\.)instagram\.com$/i },
  { platform: "twitter", host: /(?:^|\.)(twitter|x)\.com$/i },
  { platform: "linkedin", host: /(?:^|\.)linkedin\.com$/i },
  { platform: "youtube", host: /(?:^|\.)youtube\.com$/i },
  { platform: "tiktok", host: /(?:^|\.)tiktok\.com$/i },
  { platform: "pinterest", host: /(?:^|\.)pinterest\.com$/i },
  { platform: "github", host: /(?:^|\.)github\.com$/i },
  { platform: "threads", host: /(?:^|\.)threads\.net$/i },
  { platform: "snapchat", host: /(?:^|\.)snapchat\.com$/i },
  { platform: "discord", host: /(?:^|\.)discord\.(com|gg)$/i },
];

/** Paths that look like share/intent URLs (not actual profiles). */
const SHARE_PATH_RE =
  /\/(sharer|share|intent|dialog|tr|plugins|pixel)\b/i;

/**
 * Social handles belonging to website platforms/services, not the actual
 * business. These appear in CMS themes (Shopify footer, WP theme credits,
 * etc.) and should be skipped.
 */
const PLATFORM_HANDLES = new Set([
  "shopify", "wordpress", "wordpress.org", "wordpressdotcom",
  "wikimapia", "wix", "wixcom", "squarespace", "squarespaceinc",
  "weebly", "godaddy", "godaddyinc", "webflow", "webaborat",
  "joomla", "drupal", "ghost", "ghostcms", "hubspot",
  "bigcommerce", "prestashop", "magentocommerce", "magento",
  "ecwid", "volusion", "3dcart", "shift4shop", "opencart",
  "envato", "themeforest", "templatemonster", "elegantthemes",
  "developer", "developers",
]);

/**
 * Classify a raw URL string. Returns null if not a social profile.
 */
function classifyUrl(raw: string): SocialLink | null {
  if (!/^https?:\/\//i.test(raw)) return null;

  let u: URL;
  try { u = new URL(raw); } catch { return null; }

  if (SHARE_PATH_RE.test(u.pathname)) return null;

  const match = PATTERNS.find((p) => p.host.test(u.hostname));
  if (!match) return null;

  const pathClean = u.pathname.replace(/^\/+|\/+$/g, "");
  if (!pathClean) return null;

  if (match.platform === "facebook" && /^(tr|plugins|sharer)/i.test(pathClean)) return null;
  if (match.platform === "twitter" && /^(intent|share|home|login|signup)$/i.test(pathClean.split("/")[0] ?? "")) return null;

  const handle = pathClean.split("/")[0]?.toLowerCase();
  if (handle && PLATFORM_HANDLES.has(handle)) return null;

  const canonical = `${u.protocol}//${u.hostname}${u.pathname}`.replace(/\/+$/, "");
  return { platform: match.platform, url: canonical };
}

/**
 * Extract social media URLs from raw HTML by scanning <a href>, meta tags,
 * and Schema.org JSON-LD `sameAs` arrays.
 * Returns one URL per platform (first/most canonical).
 */
export function extractSocialLinks(html: string): SocialLink[] {
  const seenPlatforms = new Set<SocialPlatform>();
  const results: SocialLink[] = [];

  function add(link: SocialLink) {
    if (seenPlatforms.has(link.platform)) return;
    seenPlatforms.add(link.platform);
    results.push(link);
  }

  // 1) Schema.org JSON-LD — highest-confidence source
  const jsonLdRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jm: RegExpExecArray | null;
  while ((jm = jsonLdRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(jm[1]!);
      const sameAs: unknown[] = Array.isArray(data.sameAs) ? data.sameAs
        : typeof data.sameAs === "string" ? [data.sameAs] : [];
      for (const entry of sameAs) {
        if (typeof entry !== "string") continue;
        const link = classifyUrl(entry);
        if (link) add(link);
      }
    } catch { /* invalid JSON-LD, skip */ }
  }

  // 2) href/content attributes (links, meta og:, etc.)
  const hrefRe = /(?:href|content)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    if (!m[1]) continue;
    const link = classifyUrl(m[1]);
    if (link) add(link);
  }

  return results;
}
