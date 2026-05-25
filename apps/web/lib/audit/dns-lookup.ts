import "server-only";

import { Resolver } from "node:dns/promises";

// ─── Types ────────────────────────────────────────────────────────────

export type MxRecord = { exchange: string; priority: number };

export type DnsRecords = {
  a: string[];
  aaaa: string[];
  mx: MxRecord[];
  ns: string[];
  txt: string[];
  cname: string[];
};

export type EmailSecurity = {
  /** Has at least one MX record. */
  hasMx: boolean;
  mxCount: number;
  /** Has a v=spf1 TXT record. */
  hasSpf: boolean;
  /** Verbatim SPF policy string when present. */
  spfPolicy: string | null;
  /** Has a v=DMARC1 TXT at _dmarc.{domain}. */
  hasDmarc: boolean;
  /** Verbatim DMARC policy string when present. */
  dmarcPolicy: string | null;
  /** Extracted DMARC `p=` tag (none|quarantine|reject) — controls enforcement. */
  dmarcEnforcement: "none" | "quarantine" | "reject" | null;
};

// ─── Lookups ──────────────────────────────────────────────────────────

/**
 * Resolve all standard DNS record types for a domain in parallel. Missing
 * record types (ENODATA / ENOTFOUND) resolve to empty arrays — DNS lookup
 * partial failure is normal (many domains have no AAAA, no CNAME, etc.).
 */
export async function lookupDns(domain: string): Promise<DnsRecords> {
  const r = makeResolver();

  const [a, aaaa, mx, ns, txt, cname] = await Promise.all([
    safeResolve(() => r.resolve4(domain)),
    safeResolve(() => r.resolve6(domain)),
    safeResolveMx(() => r.resolveMx(domain)),
    safeResolve(() => r.resolveNs(domain)),
    safeResolveTxt(() => r.resolveTxt(domain)),
    safeResolve(() => r.resolveCname(domain)),
  ]);

  return {
    a,
    aaaa,
    mx,
    ns: ns.map((s) => s.toLowerCase()),
    txt,
    cname,
  };
}

/**
 * Probe SPF + DMARC from DNS. SPF lives in the apex TXT records; DMARC
 * lives in a TXT at `_dmarc.{domain}`. DKIM requires a selector so we
 * can't blanket-detect it without guessing common selectors.
 */
export async function lookupEmailSecurity(
  domain: string,
  apexTxtRecords: string[],
  mxRecords: MxRecord[],
): Promise<EmailSecurity> {
  const r = makeResolver();

  const spfPolicy = apexTxtRecords.find((t) => /^v=spf1\b/i.test(t)) ?? null;

  let dmarcPolicy: string | null = null;
  const dmarcTxts = await safeResolveTxt(() =>
    r.resolveTxt(`_dmarc.${domain}`),
  );
  for (const t of dmarcTxts) {
    if (/^v=DMARC1\b/i.test(t)) {
      dmarcPolicy = t;
      break;
    }
  }

  const dmarcEnforcement = dmarcPolicy
    ? (() => {
        const m = /\bp\s*=\s*(none|quarantine|reject)\b/i.exec(dmarcPolicy);
        const p = m?.[1]?.toLowerCase();
        if (p === "none" || p === "quarantine" || p === "reject") return p;
        return null;
      })()
    : null;

  return {
    hasMx: mxRecords.length > 0,
    mxCount: mxRecords.length,
    hasSpf: !!spfPolicy,
    spfPolicy,
    hasDmarc: !!dmarcPolicy,
    dmarcPolicy,
    dmarcEnforcement,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Use Cloudflare's public DNS (1.1.1.1, 1.0.0.1) instead of the host
 * resolver. Avoids relying on the deploy environment's nameservers and
 * gives consistent, low-latency lookups from any region.
 */
function makeResolver(): Resolver {
  const r = new Resolver({ timeout: 5_000, tries: 2 });
  r.setServers(["1.1.1.1", "1.0.0.1"]);
  return r;
}

async function safeResolve(fn: () => Promise<string[]>): Promise<string[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

async function safeResolveMx(
  fn: () => Promise<Array<{ exchange: string; priority: number }>>,
): Promise<MxRecord[]> {
  try {
    const records = await fn();
    return records
      .map((r) => ({
        exchange: r.exchange.toLowerCase(),
        priority: r.priority,
      }))
      .sort((a, b) => a.priority - b.priority);
  } catch {
    return [];
  }
}

async function safeResolveTxt(
  fn: () => Promise<string[][]>,
): Promise<string[]> {
  try {
    const chunks = await fn();
    // resolveTxt returns string[][] (each record is split by TXT spec into chunks).
    return chunks.map((parts) => parts.join(""));
  } catch {
    return [];
  }
}
