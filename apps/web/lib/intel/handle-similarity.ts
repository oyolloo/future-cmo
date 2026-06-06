import "server-only";

/**
 * Extract the most likely "brand handle" from a domain.
 * "acme-store.com"        → "acmestore"
 * "shop.tablepilot.io"    → "tablepilot"
 * "the-acme-co.com"       → "theacmeco"
 */
export function brandFromDomain(domain: string): string {
  const host = domain.toLowerCase().replace(/^www\./, "");
  const parts = host.split(".");
  // Take the second-to-last part (registered name), or first if only 2 parts
  const candidate = parts.length >= 2 ? parts[parts.length - 2]! : parts[0]!;
  return candidate.replace(/[^a-z0-9]/g, "");
}

/**
 * Extract the handle/username from a social URL.
 * https://twitter.com/acmestore           → "acmestore"
 * https://www.facebook.com/acme.store     → "acmestore"
 * https://www.linkedin.com/company/acme/  → "acme"
 * https://instagram.com/acme_store/       → "acmestore"
 */
export function handleFromSocialUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+|\/+$/g, "");
    if (!path) return null;

    // LinkedIn company URLs: /company/{slug}
    // LinkedIn profile URLs:  /in/{slug}
    const segments = path.split("/").filter(Boolean);
    let handle: string | undefined;

    if (u.hostname.includes("linkedin.com")) {
      const idx = segments.findIndex((s) => s === "company" || s === "in");
      handle = idx >= 0 ? segments[idx + 1] : segments[0];
    } else if (u.hostname.includes("youtube.com")) {
      // @handle or /channel/UC... or /c/Name or /user/Name
      const first = segments[0];
      if (first?.startsWith("@")) handle = first.slice(1);
      else if (first === "c" || first === "user" || first === "channel") handle = segments[1];
      else handle = first;
    } else if (u.hostname.includes("tiktok.com")) {
      handle = segments[0]?.replace(/^@/, "");
    } else {
      handle = segments[0]?.replace(/^@/, "");
    }

    if (!handle) return null;
    return handle.toLowerCase().replace(/[^a-z0-9]/g, "");
  } catch {
    return null;
  }
}

/**
 * String similarity 0-100 between brand and handle. Higher = better match.
 * Uses a combination of:
 *  - exact prefix containment
 *  - Levenshtein distance normalised by length
 *
 * "tablepilot" vs "tablepilot"        → 100
 * "tablepilot" vs "tablepilotapp"     → 91
 * "acmestore"  vs "acme"              → 80 (full prefix match)
 * "acmestore"  vs "shopacme"          → 55
 * "tablepilot" vs "randomname"        → 8
 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;

  // Full containment (either direction) — strong signal
  if (a.includes(b) || b.includes(a)) {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    return Math.round((shorter.length / longer.length) * 100);
  }

  // Levenshtein normalised
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return Math.max(0, Math.round((1 - dist / maxLen) * 100));
}

function levenshtein(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i]![0] = i;
  for (let j = 0; j <= b.length; j++) dp[0]![j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,        // deletion
        dp[i]![j - 1]! + 1,        // insertion
        dp[i - 1]![j - 1]! + cost, // substitution
      );
    }
  }
  return dp[a.length]![b.length]!;
}

/**
 * Match a list of social URLs against a brand and return per-URL scores.
 */
export function scoreSocialMatches(
  brand: string,
  urls: string[],
): Array<{ url: string; handle: string | null; matchPct: number }> {
  return urls.map((url) => {
    const handle = handleFromSocialUrl(url);
    const matchPct = handle ? similarity(brand, handle) : 0;
    return { url, handle, matchPct };
  });
}
