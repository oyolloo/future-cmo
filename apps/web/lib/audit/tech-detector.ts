import "server-only";

// simple-wappalyzer ships CommonJS only and has no bundled types. The
// runtime shape (confirmed against wappalyzer-core@6's `resolve()`) is
// a FLAT ARRAY of detections — NOT the {urls, applications, meta} wrapper
// shown in simple-wappalyzer's README, which is stale.
type WappalyzerCategory = {
  id: number;
  name: string;
  priority?: number;
};

type WappalyzerApplication = {
  name: string;
  description?: string;
  slug?: string;
  categories: WappalyzerCategory[];
  confidence: number;
  version: string | null;
  icon: string | null;
  website: string | null;
  pricing?: string[];
  cpe: string | null;
  rootPath?: boolean;
  lastUrl?: string;
};

type WappalyzerInput = {
  url: string;
  headers: Record<string, string | string[]>;
  html: string;
};

type WappalyzerFn = (input: WappalyzerInput) => Promise<WappalyzerApplication[]>;

// ─── Public types ─────────────────────────────────────────────────────

export type DetectedTech = {
  name: string;
  /** 0–100. Wappalyzer returns a string; we coerce to int. */
  confidence: number;
  /** Detected version string (e.g. "6.1.2"), or null when unknown. */
  version: string | null;
  /** Filename for the Wappalyzer icon (e.g. "WordPress.svg"). */
  icon: string | null;
  /** Vendor's homepage. */
  website: string | null;
  /** CPE identifier for vulnerability lookups (often null). */
  cpe: string | null;
  /** Flat list of category names ("CMS", "Analytics", "CDN", …). */
  categories: string[];
};

export type TechDetectionResult = {
  url: string;
  finalUrl: string;
  statusCode: number;
  /** Detected page language from `<html lang>` / meta. */
  language: string | null;
  /** Server response headers (lowercase keys, single-value collapsed). */
  headers: Record<string, string>;
  /** All detections, sorted by confidence desc then name asc. */
  detected: DetectedTech[];
  /**
   * Wappalyzer's own priority per category name (lower = more important).
   * Used by the UI to order category sections so CMS / Ecommerce surface
   * before infra like CDN / Security.
   */
  categoryPriority: Record<string, number>;
  /** Audit run time in ms. */
  durationMs: number;
};

export type TechDetectionError =
  | { kind: "invalid_url" }
  | { kind: "dns_not_found"; host: string }
  | { kind: "connection_refused"; host: string }
  | { kind: "connection_reset"; host: string }
  | { kind: "connection_timeout"; host: string }
  | { kind: "ssl_error"; host: string; detail: string }
  | { kind: "http_error"; status: number; statusText: string }
  | { kind: "non_html"; contentType: string }
  | { kind: "timeout" }
  | { kind: "fetch_failed"; code: string | null; message: string }
  | { kind: "analyze_failed"; message: string };

// ─── Fetch + analyze ──────────────────────────────────────────────────

/**
 * Run a full tech-stack detection pass against a URL:
 *   1. Fetch HTML (follow redirects, capture final URL + status + headers).
 *   2. Run simple-wappalyzer (happy-dom under the hood for selectors).
 *   3. Flatten the result into a UI-friendly shape.
 *
 * 15-second budget — much faster than PageSpeed since no headless Chrome.
 * Returns a discriminated result so the caller can show specific errors.
 */
export async function detectTechnologies(
  rawUrl: string,
): Promise<
  | { ok: true; data: TechDetectionResult }
  | { ok: false; error: TechDetectionError }
> {
  const url = normaliseUrl(rawUrl);
  if (!url) return { ok: false, error: { kind: "invalid_url" } };

  const started = Date.now();

  const fetched = await fetchPage(url);
  if (!fetched.ok) return fetched;

  const headersPlain = headersToPlain(fetched.headers);

  // Dynamic import — keeps simple-wappalyzer out of the client bundle.
  let wappalyze: WappalyzerFn;
  try {
    const mod = (await import("simple-wappalyzer")) as {
      default?: WappalyzerFn;
    } & WappalyzerFn;
    // CJS module — when imported via ESM, the function lives on .default.
    wappalyze = (mod.default ?? (mod as unknown as WappalyzerFn));
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "analyze_failed",
        message: err instanceof Error ? err.message : "Failed to load wappalyzer",
      },
    };
  }

  let apps: WappalyzerApplication[];
  try {
    apps = await wappalyze({
      url: fetched.finalUrl,
      headers: headersPlain,
      html: fetched.html,
    });
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: "analyze_failed",
        message: err instanceof Error ? err.message : "Unknown analyzer error",
      },
    };
  }

  // Defensive: wappalyzer occasionally returns undefined for an empty page.
  const safeApps = Array.isArray(apps) ? apps : [];

  // Collect each category's lowest priority across all techs. Wappalyzer
  // uses lower = more important (Ecommerce/CMS = 1, CDN/Security = 9,
  // Miscellaneous = 10).
  const categoryPriority: Record<string, number> = {};
  for (const app of safeApps) {
    if (!Array.isArray(app.categories)) continue;
    for (const cat of app.categories) {
      if (!cat?.name) continue;
      const prio = typeof cat.priority === "number" ? cat.priority : 10;
      const current = categoryPriority[cat.name];
      if (current == null || prio < current) {
        categoryPriority[cat.name] = prio;
      }
    }
  }

  const detected: DetectedTech[] = safeApps.map((app) => ({
    name: app.name,
    confidence:
      typeof app.confidence === "number"
        ? app.confidence
        : Number.parseInt(String(app.confidence), 10) || 0,
    version: app.version ?? null,
    icon: app.icon ?? null,
    website: app.website ?? null,
    cpe: app.cpe ?? null,
    categories: flattenCategories(app.categories),
  }));

  detected.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.name.localeCompare(b.name);
  });

  return {
    ok: true,
    data: {
      url,
      finalUrl: fetched.finalUrl,
      statusCode: fetched.statusCode,
      language: extractHtmlLang(fetched.html),
      headers: headersPlain as Record<string, string>,
      detected,
      categoryPriority,
      durationMs: Date.now() - started,
    },
  };
}

// ─── HTML fetch with full headers ────────────────────────────────────

type FetchOk = {
  ok: true;
  finalUrl: string;
  statusCode: number;
  headers: Headers;
  html: string;
};

async function fetchPage(
  url: string,
): Promise<FetchOk | { ok: false; error: TechDetectionError }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Pretend to be a real browser so we get the same response a
        // user would see (some sites serve simplified HTML to bots).
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });
    clearTimeout(timer);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("html")) {
      return {
        ok: false,
        error: { kind: "non_html", contentType },
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        error: {
          kind: "http_error",
          status: res.status,
          statusText: res.statusText || "Unknown",
        },
      };
    }

    const html = await res.text();
    return {
      ok: true,
      finalUrl: res.url || url,
      statusCode: res.status,
      headers: res.headers,
      html,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: { kind: "timeout" } };
    }
    return { ok: false, error: classifyFetchError(err, url) };
  }
}

/**
 * Node's fetch (undici) throws a generic TypeError with message "fetch
 * failed" — the real cause is hidden in `err.cause` with a `.code` like
 * ENOTFOUND / ECONNREFUSED / CERT_HAS_EXPIRED. Walk the cause chain to
 * extract a specific error kind the user can act on.
 */
function classifyFetchError(err: unknown, url: string): TechDetectionError {
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  })();

  type ErrLike = {
    code?: string;
    message?: string;
    cause?: ErrLike;
  };
  const top = err as ErrLike;
  // Walk up to 4 levels into err.cause to find a code.
  let node: ErrLike | undefined = top;
  let code: string | null = null;
  let detail = "";
  for (let i = 0; i < 4 && node; i++) {
    if (typeof node.code === "string") {
      code = node.code;
      detail = node.message ?? detail;
      break;
    }
    detail = node.message ?? detail;
    node = node.cause;
  }

  switch (code) {
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return { kind: "dns_not_found", host };
    case "ECONNREFUSED":
      return { kind: "connection_refused", host };
    case "ECONNRESET":
      return { kind: "connection_reset", host };
    case "ETIMEDOUT":
    case "UND_ERR_CONNECT_TIMEOUT":
    case "UND_ERR_HEADERS_TIMEOUT":
    case "UND_ERR_BODY_TIMEOUT":
      return { kind: "connection_timeout", host };
    case "CERT_HAS_EXPIRED":
    case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
    case "DEPTH_ZERO_SELF_SIGNED_CERT":
    case "SELF_SIGNED_CERT_IN_CHAIN":
    case "ERR_TLS_CERT_ALTNAME_INVALID":
    case "UND_ERR_SOCKET":
      return { kind: "ssl_error", host, detail: detail || code };
    default:
      return {
        kind: "fetch_failed",
        code,
        message: detail || (err instanceof Error ? err.message : "Network error"),
      };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/**
 * Convert Fetch's Headers to a plain object with lowercase keys.
 * Wappalyzer expects either string or string[] values; we keep strings.
 */
function headersToPlain(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key.toLowerCase()] = value;
  });
  return out;
}

/**
 * wappalyzer-core returns categories as Array<{ id, name, priority }>.
 * Flatten to just the name strings for the UI.
 */
function flattenCategories(raw: WappalyzerCategory[] | undefined): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const cat of raw) {
    if (cat && typeof cat.name === "string" && cat.name) {
      out.push(cat.name);
    }
  }
  return out;
}

/** Quick `<html lang="...">` extraction — no full DOM parse needed. */
function extractHtmlLang(html: string): string | null {
  const m = /<html[^>]*\blang\s*=\s*["']([^"']+)["']/i.exec(html);
  return m?.[1] ?? null;
}
