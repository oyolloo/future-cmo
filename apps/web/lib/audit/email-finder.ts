import "server-only";

// ─── Types ───────────────────────────────────────────────────────────

export type FoundEmail = {
  email: string;
  /** Pages on the site where this email appeared. */
  sources: string[];
};

export type EmailFinderResult =
  | {
      ok: true;
      data: {
        startUrl: string;
        pagesScanned: string[];
        emails: FoundEmail[];
        durationMs: number;
      };
    }
  | { ok: false; error: { message: string } };

// ─── Regex + filters ─────────────────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/** Reject obvious junk that matches the email regex but isn't a real address. */
const BLACKLIST_PATTERNS = [
  /@2x\./i, /@3x\./i,                          // retina image hashes
  /@sentry\.io/i, /@example\.(com|org|net)/i, // placeholder / monitoring
  /@your-?domain/i, /@yourcompany/i,
  /noreply@/i, /no-reply@/i, /donotreply@/i,
  /@sha256/i, /@sha512/i,                      // sometimes regex matches hashes
  /\.(png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf|css|js|map)$/i,
];

/** Slugs we'll proactively crawl in addition to the start URL. */
const CONTACT_PATHS = [
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/team",
  "/our-team",
  "/company",
  "/support",
  "/help",
  "/privacy",
  "/imprint",
  "/impressum",
];

// ─── Public ──────────────────────────────────────────────────────────

export async function findEmailsOnWebsite(
  rawUrl: string,
  options: { maxPages?: number; timeoutMsPerPage?: number } = {},
): Promise<EmailFinderResult> {
  const startUrl = normaliseUrl(rawUrl);
  if (!startUrl) {
    return { ok: false, error: { message: "Invalid URL." } };
  }

  const maxPages = options.maxPages ?? 8;
  const timeoutMs = options.timeoutMsPerPage ?? 8000;
  const started = Date.now();

  const origin = startUrl.origin;
  const scanned: string[] = [];
  const found = new Map<string, Set<string>>(); // email → pages it appeared on

  // 1) Fetch the start page
  const startHtml = await fetchPage(startUrl.toString(), timeoutMs);
  if (!startHtml.ok) {
    return { ok: false, error: { message: startHtml.error } };
  }
  scanned.push(startUrl.toString());
  collectEmails(startHtml.body, startUrl.toString(), found);

  // 2) Find candidate inner links — prefer contact/about/team
  const candidateLinks = pickCandidateLinks(
    startHtml.body,
    origin,
    maxPages - 1,
  );

  // 3) Fetch each candidate in parallel
  await Promise.all(
    candidateLinks.map(async (url) => {
      const res = await fetchPage(url, timeoutMs);
      if (!res.ok) return;
      scanned.push(url);
      collectEmails(res.body, url, found);
    }),
  );

  const emails: FoundEmail[] = [...found.entries()]
    .map(([email, sources]) => ({ email, sources: [...sources] }))
    .sort((a, b) => b.sources.length - a.sources.length);

  return {
    ok: true,
    data: {
      startUrl: startUrl.toString(),
      pagesScanned: scanned,
      emails,
      durationMs: Date.now() - started,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function normaliseUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

async function fetchPage(
  url: string,
  timeoutMs: number,
): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept: "text/html",
      },
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status} on ${url}` };
    }
    const body = await res.text();
    return { ok: true, body };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: `Timed out fetching ${url}` };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Fetch failed",
    };
  }
}

function pickCandidateLinks(
  html: string,
  origin: string,
  maxCount: number,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  // First pass — prioritise common contact-style slugs
  for (const path of CONTACT_PATHS) {
    if (out.length >= maxCount) break;
    const url = origin + path;
    if (!seen.has(url)) {
      seen.add(url);
      out.push(url);
    }
  }

  // Second pass — scrape <a href> links from the start page, same-origin only
  const linkRe = /<a[^>]*href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    if (out.length >= maxCount) break;
    const raw = m[1];
    if (!raw) continue;
    try {
      const u = new URL(raw, origin);
      if (u.origin !== origin) continue;
      const text = u.toString().split("#")[0]!;
      if (!seen.has(text) && /contact|about|team|support|help|imprint/i.test(text)) {
        seen.add(text);
        out.push(text);
      }
    } catch {
      /* ignore bad URLs */
    }
  }

  return out;
}

function collectEmails(
  html: string,
  sourceUrl: string,
  found: Map<string, Set<string>>,
): void {
  // Decode common HTML entities + mailto-encoded versions
  const decoded = html
    .replace(/&amp;/g, "&")
    .replace(/&#64;/g, "@")
    .replace(/\[at\]|\(at\)|\sat\s/gi, "@")
    .replace(/\[dot\]|\(dot\)|\sdot\s/gi, ".");

  const matches = decoded.match(EMAIL_RE) ?? [];
  for (const raw of matches) {
    const email = raw.trim().toLowerCase();
    if (BLACKLIST_PATTERNS.some((p) => p.test(email))) continue;
    if (!found.has(email)) found.set(email, new Set());
    found.get(email)!.add(sourceUrl);
  }
}
