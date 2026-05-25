import "server-only";

import { analyzeMobileFriendliness } from "./mobile-friendly";
import { analyzeAISeo, type AISeoReport } from "./ai-seo";
import { fetchRobotsReport, probeLlmsTxt } from "./robots-parser";
import { fetchHtml } from "./website";
import { detectTechnologies, type TechDetectionResult } from "./tech-detector";
import { lookupDns, lookupEmailSecurity } from "./dns-lookup";
import { lookupIpGeo, type IpGeo } from "./ip-geo";
import { lookupRdap, type RdapDomainInfo } from "./rdap";
import {
  getPagespeedDetails,
  type PagespeedDetails,
} from "./pagespeed-details";
import type { MobileFriendlyReport } from "./mobile-friendly";

// ─── Types ────────────────────────────────────────────────────────────

export type CompetitorResult = {
  url: string;
  domain: string;
  /** Each audit is nullable — partial failure is OK. */
  speed: { mobile: PagespeedDetails | null; desktop: PagespeedDetails | null } | null;
  mobileFriendly: MobileFriendlyReport | null;
  techStack: TechDetectionResult | null;
  aiSeo: AISeoReport | null;
  domainInfo: {
    rdap: RdapDomainInfo | null;
    hosting: IpGeo | null;
    daysToExpiry: number | null;
    hasSpf: boolean;
    hasDmarc: boolean;
  } | null;
  error: string | null;
};

// ─── Runner ──────────────────────────────────────────────────────────

/**
 * Run all available audit tools against a single URL. Each tool is
 * independent — a failure in one doesn't block the others. Returns
 * partial results so the comparison table can still render rows even
 * when some audits time out.
 */
export async function auditCompetitor(rawUrl: string): Promise<CompetitorResult> {
  const url = normalise(rawUrl);
  if (!url) {
    return emptyResult(rawUrl, "Invalid URL.");
  }

  const domain = extractDomain(url);
  const result: CompetitorResult = {
    url,
    domain,
    speed: null,
    mobileFriendly: null,
    techStack: null,
    aiSeo: null,
    domainInfo: null,
    error: null,
  };

  // Run all audits in parallel — each wrapped in try/catch so one
  // failure doesn't abort the others.
  const [htmlResult, speedResult, techResult, domainResult] =
    await Promise.all([
      fetchHtml(url, 12_000).catch(() => null),
      runSpeed(url),
      runTech(url),
      runDomain(domain),
    ]);

  result.speed = speedResult;
  result.techStack = techResult;
  result.domainInfo = domainResult;

  // HTML-dependent audits.
  if (htmlResult) {
    result.mobileFriendly = analyzeMobileFriendliness(url, url, htmlResult);

    const [robotsResult, hasLlmsTxt] = await Promise.all([
      fetchRobotsReport(domain).catch(() => null),
      probeLlmsTxt(domain).catch(() => false),
    ]);

    result.aiSeo = analyzeAISeo(
      url,
      url,
      htmlResult,
      robotsResult?.report ?? ({} as import("./ai-bots").RobotsReport),
      hasLlmsTxt,
    );
  }

  return result;
}

// ─── Sub-runners ────────────────────────────────────────────────────

async function runSpeed(
  url: string,
): Promise<CompetitorResult["speed"]> {
  try {
    const [mobile, desktop] = await Promise.all([
      getPagespeedDetails(url, "mobile").catch(() => ({ ok: false as const, error: { kind: "timeout" as const } })),
      getPagespeedDetails(url, "desktop").catch(() => ({ ok: false as const, error: { kind: "timeout" as const } })),
    ]);
    return {
      mobile: mobile.ok ? mobile.data : null,
      desktop: desktop.ok ? desktop.data : null,
    };
  } catch {
    return null;
  }
}

async function runTech(
  url: string,
): Promise<TechDetectionResult | null> {
  try {
    const result = await detectTechnologies(url);
    return result.ok ? result.data : null;
  } catch {
    return null;
  }
}

async function runDomain(
  domain: string,
): Promise<CompetitorResult["domainInfo"]> {
  try {
    const [rdapResult, dnsRecords] = await Promise.all([
      lookupRdap(domain),
      lookupDns(domain),
    ]);

    const email = await lookupEmailSecurity(domain, dnsRecords.txt, dnsRecords.mx);
    const primaryIp = dnsRecords.a[0] ?? null;
    let hosting: IpGeo | null = null;

    if (primaryIp) {
      const geoResult = await lookupIpGeo(primaryIp).catch(() => null);
      if (geoResult?.ok) hosting = geoResult.data;
    }

    const rdap = rdapResult.ok ? rdapResult.data : null;
    const expiry = rdap?.events.find((e) => e.action === "expiration");
    const daysToExpiry = expiry
      ? Math.floor(
          (new Date(expiry.date).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    return {
      rdap,
      hosting,
      daysToExpiry,
      hasSpf: email.hasSpf,
      hasDmarc: email.hasDmarc,
    };
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

function normalise(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function emptyResult(url: string, error: string): CompetitorResult {
  return {
    url,
    domain: url,
    speed: null,
    mobileFriendly: null,
    techStack: null,
    aiSeo: null,
    domainInfo: null,
    error,
  };
}
