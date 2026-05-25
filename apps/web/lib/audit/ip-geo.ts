import "server-only";

// ─── Types ────────────────────────────────────────────────────────────

export type IpGeo = {
  ip: string;
  /** ISP / hosting org name (e.g. "Cloudflare, Inc.", "Amazon.com, Inc."). */
  org: string | null;
  /** ASN — e.g. "AS13335" for Cloudflare. */
  asn: string | null;
  /** ASN owner — usually similar to org but more canonical. */
  asnOrg: string | null;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
  /** Reverse DNS hostname when present. */
  hostname: string | null;
};

export type IpGeoError =
  | { kind: "rate_limited" }
  | { kind: "timeout" }
  | { kind: "http_error"; status: number }
  | { kind: "invalid_response" }
  | { kind: "network"; message: string };

// ─── Lookup ──────────────────────────────────────────────────────────

/**
 * Look up geo + hosting info for an IPv4/IPv6 address using ipapi.co.
 * Free tier: 1000 requests/day, no API key needed, HTTPS. Returns null
 * for private/reserved ranges (ipapi.co rejects those with 404).
 */
export async function lookupIpGeo(
  ip: string,
): Promise<{ ok: true; data: IpGeo } | { ok: false; error: IpGeoError }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    clearTimeout(timer);

    if (res.status === 429) {
      return { ok: false, error: { kind: "rate_limited" } };
    }
    if (!res.ok) {
      return { ok: false, error: { kind: "http_error", status: res.status } };
    }

    const raw = (await res.json()) as IpapiResponse;
    if (raw.error) {
      return { ok: false, error: { kind: "invalid_response" } };
    }

    return {
      ok: true,
      data: {
        ip,
        org: raw.org ?? null,
        asn: raw.asn ?? null,
        asnOrg: raw.asn_org ?? raw.org ?? null,
        country: raw.country_name ?? null,
        countryCode: raw.country_code ?? null,
        region: raw.region ?? null,
        city: raw.city ?? null,
        hostname: null, // filled by separate PTR lookup
      },
    };
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: { kind: "timeout" } };
    }
    return {
      ok: false,
      error: {
        kind: "network",
        message: err instanceof Error ? err.message : "Unknown network error",
      },
    };
  }
}

type IpapiResponse = {
  ip?: string;
  org?: string;
  asn?: string;
  asn_org?: string;
  country_name?: string;
  country_code?: string;
  region?: string;
  city?: string;
  error?: boolean;
  reason?: string;
};
