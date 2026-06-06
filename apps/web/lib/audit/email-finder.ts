import "server-only";

// ─── Types ───────────────────────────────────────────────────────────

export type Confidence = "high" | "medium" | "low";

export type FoundEmail = {
  email: string;
  confidence: Confidence;
  /** Pages / signals where this email appeared. */
  sources: string[];
};

export type EmailFinderResult =
  | {
      ok: true;
      data: {
        domain: string;
        pagesScanned: string[];
        emails: FoundEmail[];
        durationMs: number;
      };
    }
  | { ok: false; error: { message: string } };

// ─── Constants ───────────────────────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const MAILTO_RE = /mailto:([^"'?\s<>]+)/gi;

/** Obfuscated pattern: "hello [at] acme [dot] com" */
const OBFUSCATED_RE =
  /\b([a-z0-9._%+-]+)\s*[\[\(]?\s*at\s*[\]\)]?\s*([a-z0-9.\-]+)\s*[\[\(]?\s*dot\s*[\]\)]?\s*([a-z]{2,})\b/gi;

const CONTACT_PATHS = [
  "/",
  "/contact",
  "/contact-us",
  "/contacts",
  "/about",
  "/about-us",
  "/team",
  "/staff",
  "/support",
  "/help",
  "/imprint",
  "/impressum",
];

const COMMON_LOCAL_PARTS = [
  "info",
  "hello",
  "contact",
  "support",
  "team",
  "sales",
  "admin",
];

/** Substrings that signal noise (tracking, CDN, monitoring). */
const NOISE_RE =
  /sentry|wixpress|googletagmanager|cloudfront|amazonaws|akamaized|fbcdn|cloudflare|gstatic|youtube|vimeo|@\d+x|sprite|favicon|jsdelivr|unpkg|gravatar|wp-content|wp-includes/i;

/** File-extension tails that mean it's a URL, not an email. */
const FILE_EXT_RE = /\.(png|jpe?g|gif|svg|webp|ico|css|js|map|woff2?|ttf|otf|mp4|webm|pdf|json|xml|html?)$/i;

/** Generic role addresses that shouldn't get full HIGH credit even on the site. */
const ROLE_NOREPLY_RE = /^(no-?reply|donotreply|mailer-daemon|postmaster)@/i;

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 500_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; FutureCmoBot/1.0; +https://future-cmo.app)";

// ─── Public ──────────────────────────────────────────────────────────

export async function findEmailsOnWebsite(
  rawDomain: string,
): Promise<EmailFinderResult> {
  const domain = normaliseDomain(rawDomain);
  if (!domain) {
    return { ok: false, error: { message: "Invalid domain." } };
  }

  const started = Date.now();
  const found = new Map<string, { confidence: Confidence; sources: Set<string> }>();
  const scanned: string[] = [];

  // ── 1. Site scrape ───────────────────────────────────────────────
  await scrapeSite(domain, found, scanned);

  // ── 2. Search engine (DuckDuckGo HTML) ───────────────────────────
  await scrapeSearchEngine(domain, found, scanned);

  // ── 3. Common-pattern fallback ───────────────────────────────────
  if (found.size === 0) {
    for (const local of COMMON_LOCAL_PARTS) {
      upsert(found, `${local}@${domain}`, "low", "common pattern");
    }
  }

  // ── Rank ─────────────────────────────────────────────────────────
  const emails = rankFindings(domain, found);

  return {
    ok: true,
    data: {
      domain,
      pagesScanned: scanned,
      emails,
      durationMs: Date.now() - started,
    },
  };
}

// ─── Signal 1: Site scrape ───────────────────────────────────────────

async function scrapeSite(
  domain: string,
  found: Map<string, { confidence: Confidence; sources: Set<string> }>,
  scanned: string[],
): Promise<void> {
  // Sequential per-target to be polite — single domain, no parallel hammering.
  for (const path of CONTACT_PATHS) {
    const url = `https://${domain}${path}`;
    const html = await fetchPage(url);
    if (html === null) continue;
    scanned.push(url);

    // mailto: → HIGH (someone explicitly published it)
    for (const m of html.matchAll(MAILTO_RE)) {
      const raw = (m[1] ?? "").trim();
      // Strip mailto params: mailto:foo@bar.com?subject=…
      const email = raw.split("?")[0]!.toLowerCase();
      if (!isClean(email)) continue;
      upsert(found, email, "high", url);
    }

    // Visible text — HIGH if same-domain, MEDIUM otherwise
    for (const m of html.matchAll(EMAIL_RE)) {
      const email = m[0].toLowerCase();
      if (!isClean(email)) continue;
      const conf: Confidence = email.endsWith(`@${domain}`) ? "high" : "medium";
      upsert(found, email, conf, url);
    }

    // Obfuscated emails
    for (const m of html.matchAll(OBFUSCATED_RE)) {
      const local = m[1]?.toLowerCase();
      const host = m[2]?.toLowerCase();
      const tld = m[3]?.toLowerCase();
      if (!local || !host || !tld) continue;
      const email = `${local}@${host}.${tld}`;
      if (!isClean(email)) continue;
      const conf: Confidence = email.endsWith(`@${domain}`) ? "high" : "medium";
      upsert(found, email, conf, `${url} (obfuscated)`);
    }
  }
}

// ─── Signal 2: DuckDuckGo HTML search ────────────────────────────────

async function scrapeSearchEngine(
  domain: string,
  found: Map<string, { confidence: Confidence; sources: Set<string> }>,
  scanned: string[],
): Promise<void> {
  // Phrase-search literal "@domain" to filter most noise from results.
  const q = encodeURIComponent(`"@${domain}"`);
  const url = `https://html.duckduckgo.com/html/?q=${q}`;

  const html = await fetchPage(url);
  if (html === null) return;
  scanned.push("duckduckgo.com (search)");

  for (const m of html.matchAll(EMAIL_RE)) {
    const email = m[0].toLowerCase();
    // Only keep same-domain hits from search noise.
    if (!email.endsWith(`@${domain}`)) continue;
    if (!isClean(email)) continue;
    upsert(found, email, "medium", "duckduckgo.com");
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function normaliseDomain(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  // Strip protocol, path, query, leading www, trailing slashes.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    const host = u.hostname.replace(/^www\./, "");
    // Domain must contain a dot.
    if (!host.includes(".")) return null;
    return host;
  } catch {
    return null;
  }
}

async function fetchPage(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return null;

    // Cap body size — read up to MAX_BODY_BYTES, throw away the rest.
    const reader = res.body?.getReader();
    if (!reader) return await res.text();

    const decoder = new TextDecoder();
    let buf = "";
    let total = 0;
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      buf += decoder.decode(value, { stream: true });
    }
    try { reader.cancel(); } catch { /* ignore */ }
    return buf;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

function isClean(email: string): boolean {
  if (email.length < 5 || email.length > 254) return false;
  if (!email.includes("@")) return false;
  if (FILE_EXT_RE.test(email)) return false;
  if (NOISE_RE.test(email)) return false;
  // Reject duplicate @ or leading/trailing dots/dashes
  if ((email.match(/@/g) ?? []).length !== 1) return false;
  const [, host] = email.split("@");
  if (!host || !host.includes(".")) return false;
  if (host.startsWith(".") || host.endsWith(".")) return false;
  return true;
}

function upsert(
  map: Map<string, { confidence: Confidence; sources: Set<string> }>,
  email: string,
  confidence: Confidence,
  source: string,
): void {
  const existing = map.get(email);
  if (!existing) {
    map.set(email, { confidence, sources: new Set([source]) });
    return;
  }
  existing.sources.add(source);
  // Upgrade only — never downgrade.
  if (rank(confidence) > rank(existing.confidence)) {
    existing.confidence = confidence;
  }
}

function rank(c: Confidence): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

function rankFindings(
  domain: string,
  map: Map<string, { confidence: Confidence; sources: Set<string> }>,
): FoundEmail[] {
  return [...map.entries()]
    .map(([email, v]) => ({
      email,
      confidence: ROLE_NOREPLY_RE.test(email)
        // Downgrade noreply/postmaster even if scraped — not useful for outreach
        ? ("low" as Confidence)
        : v.confidence,
      sources: [...v.sources],
    }))
    .sort((a, b) => {
      // 1. Confidence first
      const dr = rank(b.confidence) - rank(a.confidence);
      if (dr !== 0) return dr;
      // 2. Same-domain emails before partners/vendors
      const aOwn = a.email.endsWith(`@${domain}`) ? 1 : 0;
      const bOwn = b.email.endsWith(`@${domain}`) ? 1 : 0;
      if (aOwn !== bOwn) return bOwn - aOwn;
      // 3. More sources = more trusted
      const ds = b.sources.length - a.sources.length;
      if (ds !== 0) return ds;
      return a.email.localeCompare(b.email);
    });
}
