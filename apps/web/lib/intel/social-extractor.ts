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
 * Extract social media URLs from raw HTML by scanning <a href> and
 * meta tags. Returns one URL per platform (the first/most canonical one).
 */
export function extractSocialLinks(html: string): SocialLink[] {
  const candidates: SocialLink[] = [];
  const seenPlatforms = new Set<SocialPlatform>();

  const hrefRe = /(?:href|content)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;

  while ((m = hrefRe.exec(html)) !== null) {
    const raw = m[1];
    if (!raw) continue;
    if (!/^https?:\/\//i.test(raw)) continue;

    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      continue;
    }

    if (SHARE_PATH_RE.test(u.pathname)) continue;

    const match = PATTERNS.find((p) => p.host.test(u.hostname));
    if (!match) continue;

    // Skip if URL is just the platform root (no profile path)
    const pathClean = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!pathClean) continue;

    if (seenPlatforms.has(match.platform)) continue;

    // Skip platform-internal paths that aren't profiles
    if (match.platform === "facebook" && /^(tr|plugins|sharer)/i.test(pathClean)) continue;
    if (match.platform === "twitter" && /^(intent|share|home|login|signup)$/i.test(pathClean.split("/")[0] ?? "")) continue;

    // Strip query and hash, keep canonical path
    const canonical = `${u.protocol}//${u.hostname}${u.pathname}`.replace(/\/+$/, "");

    candidates.push({ platform: match.platform, url: canonical });
    seenPlatforms.add(match.platform);
  }

  return candidates;
}
