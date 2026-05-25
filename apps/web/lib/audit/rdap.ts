import "server-only";

// ─── Public types ─────────────────────────────────────────────────────

export type RdapEvent = {
  action: string; // "registration" | "expiration" | "last changed" | …
  date: string; // ISO timestamp
};

export type RdapEntity = {
  /** Roles assigned to this contact (registrar, registrant, admin, tech, abuse). */
  roles: string[];
  /** Human-readable contact name when present. */
  name: string | null;
  /** Email when present. */
  email: string | null;
  /** Phone number when present. */
  phone: string | null;
  /** Country (vCard ADR field) when present. */
  country: string | null;
};

export type RdapDomainInfo = {
  domain: string;
  /** Status flags Lighthouse-style ("client transfer prohibited", etc.). */
  status: string[];
  /** Nameservers as declared by the registry. */
  nameservers: string[];
  /** Whether DNSSEC delegation is signed. */
  dnssecEnabled: boolean;
  /** All registry events (registration / expiry / last update). */
  events: RdapEvent[];
  /** Flattened registrar entity for quick display. */
  registrar: RdapEntity | null;
  /** Other entities (registrant, admin, tech, abuse) when published. */
  otherEntities: RdapEntity[];
};

export type RdapError =
  | { kind: "invalid_domain" }
  | { kind: "not_found"; domain: string }
  | { kind: "tld_unsupported"; tld: string }
  | { kind: "rate_limited" }
  | { kind: "timeout" }
  | { kind: "http_error"; status: number; message: string }
  | { kind: "network"; message: string };

// ─── Fetch ────────────────────────────────────────────────────────────

// rdap.org is a community-maintained redirect service that bootstraps
// against the IANA RDAP registry — covers every TLD that has RDAP support.
const RDAP_BOOTSTRAP = "https://rdap.org/domain";

/**
 * Fetch RDAP (Registration Data Access Protocol) info for a domain. RDAP
 * is the modern HTTPS+JSON replacement for legacy WHOIS — supported by
 * every gTLD and most ccTLDs in 2026.
 *
 * Returns a normalised shape so the UI doesn't need to know about vCard
 * arrays or RDAP event types.
 */
export async function lookupRdap(
  domain: string,
): Promise<
  | { ok: true; data: RdapDomainInfo }
  | { ok: false; error: RdapError }
> {
  const normalised = domain.trim().toLowerCase();
  if (!isLikelyDomain(normalised)) {
    return { ok: false, error: { kind: "invalid_domain" } };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${RDAP_BOOTSTRAP}/${normalised}`, {
      signal: controller.signal,
      headers: { Accept: "application/rdap+json, application/json" },
      cache: "no-store",
      redirect: "follow",
    });
    clearTimeout(timer);

    if (res.status === 404) {
      return { ok: false, error: { kind: "not_found", domain: normalised } };
    }
    if (res.status === 429) {
      return { ok: false, error: { kind: "rate_limited" } };
    }
    if (res.status === 501) {
      const tld = normalised.split(".").pop() ?? normalised;
      return { ok: false, error: { kind: "tld_unsupported", tld } };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        error: {
          kind: "http_error",
          status: res.status,
          message: body.slice(0, 200) || res.statusText,
        },
      };
    }

    const raw = (await res.json()) as RawRdapResponse;
    return { ok: true, data: parseRdap(normalised, raw) };
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

// ─── Parser ───────────────────────────────────────────────────────────

type RawRdapResponse = {
  ldhName?: string;
  status?: string[];
  events?: Array<{ eventAction?: string; eventDate?: string }>;
  nameservers?: Array<{ ldhName?: string }>;
  secureDNS?: { delegationSigned?: boolean };
  entities?: Array<RawRdapEntity>;
};

type RawRdapEntity = {
  roles?: string[];
  vcardArray?: unknown;
  entities?: RawRdapEntity[];
};

function parseRdap(domain: string, raw: RawRdapResponse): RdapDomainInfo {
  const events: RdapEvent[] = (raw.events ?? []).flatMap((e) =>
    e.eventAction && e.eventDate
      ? [{ action: e.eventAction, date: e.eventDate }]
      : [],
  );

  const nameservers = (raw.nameservers ?? []).flatMap((ns) =>
    ns.ldhName ? [ns.ldhName.toLowerCase()] : [],
  );

  const allEntities = flattenEntities(raw.entities ?? []);
  const parsedEntities = allEntities.map(parseEntity);

  const registrar =
    parsedEntities.find((e) => e.roles.includes("registrar")) ?? null;
  const otherEntities = parsedEntities.filter(
    (e) => !e.roles.includes("registrar"),
  );

  return {
    domain: raw.ldhName?.toLowerCase() ?? domain,
    status: raw.status ?? [],
    nameservers,
    dnssecEnabled: !!raw.secureDNS?.delegationSigned,
    events,
    registrar,
    otherEntities,
  };
}

/** Recursively flatten nested entities (RDAP nests registrar's abuse contact, etc.). */
function flattenEntities(entities: RawRdapEntity[]): RawRdapEntity[] {
  const out: RawRdapEntity[] = [];
  for (const ent of entities) {
    out.push(ent);
    if (Array.isArray(ent.entities)) {
      out.push(...flattenEntities(ent.entities));
    }
  }
  return out;
}

/**
 * Parse the RDAP vCard array. vCard is jCard format:
 *   ["vcard", [["version",{},"text","4.0"], ["fn",{},"text","Acme"], …]]
 */
function parseEntity(raw: RawRdapEntity): RdapEntity {
  const roles = raw.roles ?? [];
  let name: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let country: string | null = null;

  if (Array.isArray(raw.vcardArray) && raw.vcardArray.length >= 2) {
    const props = raw.vcardArray[1];
    if (Array.isArray(props)) {
      for (const prop of props) {
        if (!Array.isArray(prop) || prop.length < 4) continue;
        const [field, , , value] = prop as [
          string,
          unknown,
          string,
          unknown,
        ];
        switch (field) {
          case "fn":
          case "org":
            if (typeof value === "string" && !name) name = value;
            break;
          case "email":
            if (typeof value === "string" && !email) email = value;
            break;
          case "tel":
            if (typeof value === "string" && !phone) phone = value;
            break;
          case "adr":
            // adr value is an array: [PO, ext, street, city, region, post, country]
            if (Array.isArray(value) && value.length >= 7) {
              const c = value[6];
              if (typeof c === "string" && c) country = c;
            }
            break;
        }
      }
    }
  }

  return { roles, name, email, phone, country };
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Cheap domain validation — must have at least one dot, all label parts
 * non-empty and valid LDH (letter/digit/hyphen), no leading/trailing
 * hyphens. Stricter than URL parsing but rejects garbage upfront.
 */
function isLikelyDomain(s: string): boolean {
  if (!s || s.length > 253) return false;
  if (!s.includes(".")) return false;
  return s.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label));
}
