"use server";

import { promises as dns } from "node:dns";

import { requireUser } from "@/lib/auth/session";
import {
  lookupDns,
  lookupEmailSecurity,
  type DnsRecords,
  type EmailSecurity,
} from "@/lib/audit/dns-lookup";
import { lookupIpGeo, type IpGeo } from "@/lib/audit/ip-geo";
import { lookupRdap, type RdapDomainInfo } from "@/lib/audit/rdap";

// ─── Public state ────────────────────────────────────────────────────

export type DomainAuditData = {
  /** Input domain (normalised, lowercase, no scheme). */
  domain: string;
  /** RDAP — registrar, dates, status. Null when the TLD doesn't support RDAP. */
  rdap: RdapDomainInfo | null;
  rdapError: string | null;
  /** DNS records. */
  dns: DnsRecords;
  /** SPF/DMARC/MX summary. */
  email: EmailSecurity;
  /** Geo + ASN of the primary A record (first IPv4). Null when no A. */
  geo: IpGeo | null;
  geoError: string | null;
  /** Number of days until domain expiry (negative = already expired, null = unknown). */
  daysToExpiry: number | null;
  /** Wall-clock audit duration in ms. */
  durationMs: number;
};

export type DomainAuditState =
  | { ok: true; data: DomainAuditData }
  | { ok: false; error: { message: string } };

// ─── Action ──────────────────────────────────────────────────────────

export async function auditDomainAction(
  rawInput: string,
): Promise<DomainAuditState> {
  await requireUser();

  const domain = normaliseDomain(rawInput);
  if (!domain) {
    return {
      ok: false,
      error: {
        message:
          "Enter a domain (example.com) or full URL (https://example.com).",
      },
    };
  }

  const started = Date.now();

  // RDAP + DNS in parallel — they're fully independent.
  const [rdapResult, dnsRecords] = await Promise.all([
    lookupRdap(domain),
    lookupDns(domain),
  ]);

  // Email security depends on DNS apex TXT + MX records.
  const email = await lookupEmailSecurity(domain, dnsRecords.txt, dnsRecords.mx);

  // Geo lookup needs an A record; reverse DNS in parallel.
  const primaryIp = dnsRecords.a[0] ?? null;
  let geo: IpGeo | null = null;
  let geoError: string | null = null;
  if (primaryIp) {
    const [geoResult, hostname] = await Promise.all([
      lookupIpGeo(primaryIp),
      reverseDns(primaryIp),
    ]);
    if (geoResult.ok) {
      geo = { ...geoResult.data, hostname };
    } else {
      geoError = geoErrorMessage(geoResult.error);
    }
  }

  const daysToExpiry = computeDaysToExpiry(rdapResult.ok ? rdapResult.data : null);

  return {
    ok: true,
    data: {
      domain,
      rdap: rdapResult.ok ? rdapResult.data : null,
      rdapError: rdapResult.ok ? null : rdapErrorMessage(rdapResult.error),
      dns: dnsRecords,
      email,
      geo,
      geoError,
      daysToExpiry,
      durationMs: Date.now() - started,
    },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────

function normaliseDomain(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  // Strip scheme + path so users can paste full URLs.
  let candidate = trimmed;
  try {
    if (/^https?:\/\//.test(trimmed)) {
      candidate = new URL(trimmed).hostname;
    } else {
      candidate = trimmed.split("/")[0] ?? trimmed;
    }
  } catch {
    return null;
  }

  // Strip leading www. — registrar info is for the apex.
  candidate = candidate.replace(/^www\./i, "");

  if (!candidate.includes(".")) return null;
  if (!/^[a-z0-9.-]+$/.test(candidate)) return null;
  return candidate;
}

async function reverseDns(ip: string): Promise<string | null> {
  try {
    const hosts = await dns.reverse(ip);
    return hosts[0]?.toLowerCase() ?? null;
  } catch {
    return null;
  }
}

function computeDaysToExpiry(rdap: RdapDomainInfo | null): number | null {
  if (!rdap) return null;
  const expiry = rdap.events.find((e) => e.action === "expiration");
  if (!expiry) return null;
  const ms = new Date(expiry.date).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function rdapErrorMessage(error: import("@/lib/audit/rdap").RdapError): string {
  switch (error.kind) {
    case "invalid_domain":
      return "Domain format is invalid.";
    case "not_found":
      return `Registry has no record of "${error.domain}" — domain may be unregistered or recently dropped.`;
    case "tld_unsupported":
      return `The .${error.tld} TLD doesn't expose RDAP — registrar info isn't available via this protocol.`;
    case "rate_limited":
      return "RDAP server is rate-limiting us. Try again in a minute.";
    case "timeout":
      return "RDAP lookup timed out after 15s.";
    case "http_error":
      return `RDAP returned ${error.status}: ${error.message}`;
    case "network":
      return `Network error reaching RDAP: ${error.message}`;
  }
}

function geoErrorMessage(error: import("@/lib/audit/ip-geo").IpGeoError): string {
  switch (error.kind) {
    case "rate_limited":
      return "ipapi.co is rate-limiting us (1000/day free). Try again later.";
    case "timeout":
      return "IP geo lookup timed out.";
    case "http_error":
      return `IP geo returned HTTP ${error.status}.`;
    case "invalid_response":
      return "IP geo returned an invalid response (private/reserved IP?).";
    case "network":
      return `Network error: ${error.message}`;
  }
}
