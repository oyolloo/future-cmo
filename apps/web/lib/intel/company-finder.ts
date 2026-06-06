import "server-only";

import { z } from "zod";

import { chatJson, FREE_MODELS } from "../ai/openrouter";
import { findEmailsOnWebsite } from "../audit/email-finder";
import {
  brandFromDomain,
  scoreSocialMatches,
} from "./handle-similarity";
import { extractCompanyMeta, type CompanyMeta } from "./schema-parser";
import {
  extractSocialLinks,
  type SocialLink,
  type SocialPlatform,
} from "./social-extractor";

// ─── Types ───────────────────────────────────────────────────────────

export type Confidence = "high" | "medium" | "low";

export type SocialResult = {
  platform: SocialPlatform;
  url: string;
  handle: string | null;
  /** 0-100 how much the handle matches the brand */
  matchPct: number;
  source: "site" | "schema-sameAs";
};

export type CompanyPerson = {
  name: string;
  designation: string | null;
  confidence: Confidence;
};

export type CompanyIntelResult =
  | {
      ok: true;
      data: {
        domain: string;
        brand: string;
        company: {
          name: string | null;
          description: string | null;
          logoUrl: string | null;
          address: string | null;
          phone: string | null;
        };
        emails: Array<{ email: string; confidence: Confidence }>;
        socials: SocialResult[];
        people: CompanyPerson[];
        pagesScanned: string[];
        durationMs: number;
      };
    }
  | { ok: false; error: { message: string } };

// ─── Constants ───────────────────────────────────────────────────────

const CONTACT_PATHS = [
  "/",
  "/contact",
  "/contact-us",
  "/about",
  "/about-us",
  "/team",
  "/our-team",
  "/leadership",
  "/founders",
  "/imprint",
];

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 600_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; FutureCmoBot/1.0; +https://future-cmo.app)";

// ─── Public ──────────────────────────────────────────────────────────

export async function findCompanyIntel(
  rawDomain: string,
): Promise<CompanyIntelResult> {
  const domain = normaliseDomain(rawDomain);
  if (!domain) {
    return { ok: false, error: { message: "Invalid domain or URL." } };
  }

  const started = Date.now();
  const brand = brandFromDomain(domain);

  // 1) Scrape pages sequentially (polite, single target)
  const pages = await scrapePages(domain);
  if (pages.length === 0) {
    return { ok: false, error: { message: `Could not reach ${domain}` } };
  }
  const allHtml = pages.map((p) => p.html).join("\n");

  // 2) Structured meta from JSON-LD + OG
  const meta = extractCompanyMeta(allHtml);

  // 3) Social links — combine on-page + sameAs from schema
  const socials = collectSocials(allHtml, meta);

  // 4) Score brand ↔ handle match
  const socialResults: SocialResult[] = socials.map((s) => {
    const scored = scoreSocialMatches(brand, [s.url])[0]!;
    return {
      platform: s.platform,
      url: s.url,
      handle: scored.handle,
      matchPct: scored.matchPct,
      source: s.source,
    };
  });

  // 5) Email finder — reuse existing 3-signal pipeline
  const emailRes = await findEmailsOnWebsite(domain).catch(() => null);
  const emails = (emailRes?.ok ? emailRes.data.emails : []).map((e) => ({
    email: e.email,
    confidence: e.confidence,
  }));

  // 6) LLM extraction for people (founders/owners + designations)
  //    Pull about/team page text and let a free model extract.
  const aboutText = pages
    .filter((p) => /\/(about|team|leadership|founders)/i.test(p.url))
    .map((p) => stripTags(p.html).slice(0, 6000))
    .join("\n\n")
    .slice(0, 12_000);

  const people = await extractPeopleWithLlm(aboutText, meta.name ?? domain).catch(
    () => [] as CompanyPerson[],
  );

  return {
    ok: true,
    data: {
      domain,
      brand,
      company: {
        name: meta.name,
        description: meta.description,
        logoUrl: meta.logoUrl,
        address: meta.address,
        phone: meta.phone,
      },
      emails,
      socials: socialResults.sort((a, b) => b.matchPct - a.matchPct),
      people,
      pagesScanned: pages.map((p) => p.url),
      durationMs: Date.now() - started,
    },
  };
}

// ─── Scrape ──────────────────────────────────────────────────────────

async function scrapePages(
  domain: string,
): Promise<Array<{ url: string; html: string }>> {
  const out: Array<{ url: string; html: string }> = [];
  for (const path of CONTACT_PATHS) {
    const url = `https://${domain}${path}`;
    const html = await fetchPage(url);
    if (html !== null) out.push({ url, html });
  }
  return out;
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

// ─── Socials ─────────────────────────────────────────────────────────

function collectSocials(
  html: string,
  meta: CompanyMeta,
): Array<SocialLink & { source: "site" | "schema-sameAs" }> {
  const out: Array<SocialLink & { source: "site" | "schema-sameAs" }> = [];

  // schema.org sameAs → highest authority
  for (const url of meta.sameAs) {
    const links = extractSocialLinks(`<a href="${url}">x</a>`);
    for (const l of links) {
      if (!out.some((o) => o.platform === l.platform)) {
        out.push({ ...l, source: "schema-sameAs" });
      }
    }
  }

  // Page HTML
  for (const l of extractSocialLinks(html)) {
    if (!out.some((o) => o.platform === l.platform)) {
      out.push({ ...l, source: "site" });
    }
  }

  return out;
}

// ─── LLM person extraction ──────────────────────────────────────────

const PeopleSchema = z.object({
  people: z
    .array(
      z.object({
        name: z.string().min(2).max(120),
        designation: z.string().max(120).nullable(),
      }),
    )
    .max(8),
});

async function extractPeopleWithLlm(
  text: string,
  companyName: string,
): Promise<CompanyPerson[]> {
  if (text.trim().length < 100) return [];

  const result = await chatJson(
    [
      {
        role: "user",
        content: `Extract the founders, executives, and key team members mentioned in this About / Team page text for "${companyName}".

Return JSON: { "people": [{ "name": "Full Name", "designation": "Title or null" }] }

Rules:
- Only include real people clearly named with roles (CEO, Founder, CTO, etc.)
- Skip generic "the team", "we", "our staff"
- Maximum 8 people, prioritise founders/CEOs first
- If a person has no role explicitly stated, set designation to null
- If no real people are mentioned, return { "people": [] }

Text:
"""
${text}
"""`,
      },
    ],
    PeopleSchema,
    {
      models: [...FREE_MODELS],
      temperature: 0.1,
      maxTokens: 800,
    },
  );

  if (!result.ok) return [];

  return result.data.people.map((p) => ({
    name: p.name.trim(),
    designation: p.designation?.trim() || null,
    confidence: "medium" as const,
  }));
}

// ─── Utils ───────────────────────────────────────────────────────────

function normaliseDomain(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    const host = u.hostname.replace(/^www\./, "");
    if (!host.includes(".")) return null;
    return host;
  } catch {
    return null;
  }
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
