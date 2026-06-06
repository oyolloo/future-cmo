import "server-only";

export type CompanyMeta = {
  name: string | null;
  description: string | null;
  logoUrl: string | null;
  /** Postal address from JSON-LD Organization */
  address: string | null;
  /** Phone from JSON-LD or contact patterns */
  phone: string | null;
  /** sameAs URLs from JSON-LD (often social media) */
  sameAs: string[];
};

/**
 * Extract structured company info from HTML.
 * Priority order: JSON-LD → OpenGraph → <title> / <meta>
 */
export function extractCompanyMeta(html: string): CompanyMeta {
  const ld = parseJsonLd(html);

  const name =
    ld.name ?? extractMeta(html, "og:site_name") ?? extractMeta(html, "og:title") ?? extractTitle(html);
  const description =
    ld.description ?? extractMeta(html, "og:description") ?? extractMeta(html, "description");
  const logoUrl = ld.logo ?? extractMeta(html, "og:image");
  const address = ld.address;
  const phone = ld.phone ?? extractPhoneFromHtml(html);

  return {
    name: name?.trim() || null,
    description: description?.trim() || null,
    logoUrl: logoUrl?.trim() || null,
    address: address?.trim() || null,
    phone: phone?.trim() || null,
    sameAs: ld.sameAs,
  };
}

// ─── JSON-LD ─────────────────────────────────────────────────────────

type LdResult = {
  name: string | null;
  description: string | null;
  logo: string | null;
  address: string | null;
  phone: string | null;
  sameAs: string[];
};

function parseJsonLd(html: string): LdResult {
  const out: LdResult = {
    name: null,
    description: null,
    logo: null,
    address: null,
    phone: null,
    sameAs: [],
  };

  const scriptRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;

  while ((m = scriptRe.exec(html)) !== null) {
    const raw = m[1]?.trim();
    if (!raw) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Some sites wrap multiple in @graph or have trailing commas
      const cleaned = raw.replace(/,(\s*[}\]])/g, "$1");
      try {
        parsed = JSON.parse(cleaned);
      } catch {
        continue;
      }
    }

    const items = flattenLd(parsed);
    for (const item of items) {
      const type = String((item as Record<string, unknown>)["@type"] ?? "").toLowerCase();
      if (!/organization|localbusiness|store|corporation/.test(type)) continue;

      mergeLd(out, item as Record<string, unknown>);
    }
  }

  return out;
}

function flattenLd(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(flattenLd);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj["@graph"] && Array.isArray(obj["@graph"])) {
      return obj["@graph"].flatMap(flattenLd);
    }
    return [obj];
  }
  return [];
}

function mergeLd(out: LdResult, item: Record<string, unknown>): void {
  if (!out.name && typeof item.name === "string") out.name = item.name;
  if (!out.description && typeof item.description === "string")
    out.description = item.description;

  if (!out.logo) {
    const logo = item.logo;
    if (typeof logo === "string") out.logo = logo;
    else if (logo && typeof logo === "object" && typeof (logo as Record<string, unknown>).url === "string") {
      out.logo = (logo as Record<string, unknown>).url as string;
    }
  }

  if (!out.phone && typeof item.telephone === "string") out.phone = item.telephone;

  if (!out.address) {
    const addr = item.address;
    if (typeof addr === "string") out.address = addr;
    else if (addr && typeof addr === "object") {
      const a = addr as Record<string, unknown>;
      const parts = [
        a.streetAddress,
        a.addressLocality,
        a.addressRegion,
        a.postalCode,
        a.addressCountry,
      ]
        .filter((p) => typeof p === "string" && p)
        .join(", ");
      if (parts) out.address = parts;
    }
  }

  if (Array.isArray(item.sameAs)) {
    for (const u of item.sameAs) {
      if (typeof u === "string" && !out.sameAs.includes(u)) {
        out.sameAs.push(u);
      }
    }
  } else if (typeof item.sameAs === "string" && !out.sameAs.includes(item.sameAs)) {
    out.sameAs.push(item.sameAs);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function extractMeta(html: string, name: string): string | null {
  const re1 = new RegExp(
    `<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`,
    "i",
  );
  const re2 = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`,
    "i",
  );
  return re1.exec(html)?.[1] ?? re2.exec(html)?.[1] ?? null;
}

function extractTitle(html: string): string | null {
  const m = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
  return m?.[1]?.trim() ?? null;
}

/** Find a plausible US/international phone number in HTML. */
function extractPhoneFromHtml(html: string): string | null {
  // tel: links — highest confidence
  const tel = /(?:href=["']tel:)([+\d\s().\-]{7,20})/i.exec(html);
  if (tel?.[1]) return tel[1].replace(/\s+/g, " ").trim();

  // Generic phone pattern (US-style + intl)
  const generic = /(\+?\d{1,3}[\s.\-]?\(?\d{2,4}\)?[\s.\-]?\d{3,4}[\s.\-]?\d{3,4})/.exec(
    html,
  );
  if (generic?.[1]) return generic[1].replace(/\s+/g, " ").trim();

  return null;
}
