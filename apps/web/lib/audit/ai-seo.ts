import "server-only";

import type { RobotsReport } from "./robots-parser";

// ─── Types ────────────────────────────────────────────────────────────

export type AISeoCheck = {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn" | "info";
  detail: string;
  weight: number;
  maxWeight: number;
};

export type DetectedSchema = {
  type: string;
  hasAuthor: boolean;
  hasDateModified: boolean;
  hasMainEntityOfPage: boolean;
  hasSameAs: boolean;
};

export type ContentStats = {
  h1Count: number;
  h2Count: number;
  h3Count: number;
  paragraphCount: number;
  /** Mean characters per paragraph — short paragraphs score better. */
  avgParagraphChars: number;
  wordCount: number;
  listCount: number;
  tableCount: number;
  hasFaqPattern: boolean;
  outboundLinkCount: number;
};

export type AISeoSignals = {
  schemas: DetectedSchema[];
  contentStats: ContentStats;
  hasOpenGraph: boolean;
  hasTwitterCard: boolean;
  hasCanonical: boolean;
  hasAuthorBio: boolean;
  hasLastUpdated: boolean;
};

export type AISeoReport = {
  url: string;
  finalUrl: string;
  /** 0–100 weighted programmatic score. */
  score: number;
  band: "weak" | "warming" | "strong";
  checks: AISeoCheck[];
  signals: AISeoSignals;
  /** Per-AI-bot crawl access derived from robots.txt. */
  botAccess: RobotsReport;
  /** Has /llms.txt published. */
  hasLlmsTxt: boolean;
};

// ─── Probe ────────────────────────────────────────────────────────────

export function analyzeAISeo(
  url: string,
  finalUrl: string,
  html: string,
  botAccess: RobotsReport,
  hasLlmsTxt: boolean,
): AISeoReport {
  const schemas = extractJsonLdSchemas(html);
  const contentStats = computeContentStats(html);

  const signals: AISeoSignals = {
    schemas,
    contentStats,
    hasOpenGraph: /<meta[^>]*property=["']og:(title|image|type)["']/i.test(
      html,
    ),
    hasTwitterCard: /<meta[^>]*name=["']twitter:card["']/i.test(html),
    hasCanonical: /<link[^>]*rel=["']canonical["']/i.test(html),
    hasAuthorBio:
      /class=["'][^"']*\b(author|byline|writer|contributor)\b/i.test(html) ||
      schemas.some((s) => s.hasAuthor),
    hasLastUpdated:
      schemas.some((s) => s.hasDateModified) ||
      /(updated|modified|revised)\s+(on\s+)?\d{1,2}\b/i.test(html),
  };

  const checks = buildChecks(signals, botAccess, hasLlmsTxt);

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const maxTotal = checks.reduce((sum, c) => sum + c.maxWeight, 0);
  const score =
    maxTotal > 0 ? Math.round((totalWeight / maxTotal) * 100) : 0;
  const band: AISeoReport["band"] =
    score >= 75 ? "strong" : score >= 45 ? "warming" : "weak";

  return {
    url,
    finalUrl,
    score,
    band,
    checks,
    signals,
    botAccess,
    hasLlmsTxt,
  };
}

// ─── Checks ──────────────────────────────────────────────────────────

function buildChecks(
  signals: AISeoSignals,
  botAccess: RobotsReport,
  hasLlmsTxt: boolean,
): AISeoCheck[] {
  const checks: AISeoCheck[] = [];
  const { schemas, contentStats } = signals;

  // 1. JSON-LD structured data — biggest single AI-citability signal
  const structuredTypes = schemas
    .map((s) => s.type)
    .filter((t) => /^(Article|NewsArticle|BlogPosting|Product|FAQPage|HowTo|Recipe|Event|LocalBusiness|Service)$/i.test(t));
  if (structuredTypes.length === 0) {
    checks.push({
      id: "schema-content",
      label: "Content-type JSON-LD schema",
      status: "fail",
      detail:
        "No Article / Product / FAQ / HowTo / LocalBusiness schema found. AI engines need structured types to confidently cite a page as the answer to a query.",
      weight: 0,
      maxWeight: 20,
    });
  } else {
    checks.push({
      id: "schema-content",
      label: "Content-type JSON-LD schema",
      status: "pass",
      detail: `Found: ${structuredTypes.join(", ")}.`,
      weight: 20,
      maxWeight: 20,
    });
  }

  // 2. Organization / brand entity
  const orgSchema = schemas.find((s) =>
    /^(Organization|LocalBusiness|Corporation)$/i.test(s.type),
  );
  if (!orgSchema) {
    checks.push({
      id: "schema-org",
      label: "Organization schema",
      status: "fail",
      detail:
        "No Organization schema. LLMs use this to associate the page with a named brand entity in their training data.",
      weight: 0,
      maxWeight: 10,
    });
  } else if (!orgSchema.hasSameAs) {
    checks.push({
      id: "schema-org",
      label: "Organization schema",
      status: "warn",
      detail:
        "Organization schema present but no sameAs URLs. Add sameAs links to Wikipedia/Wikidata/social profiles so LLMs can cross-reference your brand.",
      weight: 5,
      maxWeight: 10,
    });
  } else {
    checks.push({
      id: "schema-org",
      label: "Organization schema",
      status: "pass",
      detail: "Organization schema with sameAs entity links present.",
      weight: 10,
      maxWeight: 10,
    });
  }

  // 3. Author + dateModified — E-E-A-T signals
  const hasAuthorOnAny = schemas.some((s) => s.hasAuthor);
  const hasDateOnAny = schemas.some((s) => s.hasDateModified);
  if (hasAuthorOnAny && hasDateOnAny) {
    checks.push({
      id: "author-date",
      label: "Author + dateModified",
      status: "pass",
      detail: "Both author and dateModified declared on schema.",
      weight: 10,
      maxWeight: 10,
    });
  } else if (hasAuthorOnAny || hasDateOnAny) {
    checks.push({
      id: "author-date",
      label: "Author + dateModified",
      status: "warn",
      detail: `Only ${hasAuthorOnAny ? "author" : "dateModified"} declared. Both improve LLM citation confidence — add the missing one.`,
      weight: 5,
      maxWeight: 10,
    });
  } else {
    checks.push({
      id: "author-date",
      label: "Author + dateModified",
      status: "fail",
      detail:
        "Neither author nor dateModified found. LLMs heavily down-rank uncredited / undated content.",
      weight: 0,
      maxWeight: 10,
    });
  }

  // 4. AI bot crawl access
  const criticalBots = ["GPTBot", "ClaudeBot", "PerplexityBot", "Google-Extended"] as const;
  const blocked = criticalBots.filter((b) => botAccess[b] === "disallow");
  if (blocked.length === 0) {
    checks.push({
      id: "bot-access",
      label: "AI bot access in robots.txt",
      status: "pass",
      detail: `All major AI bots allowed (${criticalBots.join(", ")}).`,
      weight: 20,
      maxWeight: 20,
    });
  } else if (blocked.length < criticalBots.length) {
    checks.push({
      id: "bot-access",
      label: "AI bot access in robots.txt",
      status: "warn",
      detail: `Partially blocked: ${blocked.join(", ")}. These engines can't index this page for citation.`,
      weight: Math.max(0, 20 - blocked.length * 5),
      maxWeight: 20,
    });
  } else {
    checks.push({
      id: "bot-access",
      label: "AI bot access in robots.txt",
      status: "fail",
      detail: `All AI bots blocked. ChatGPT / Claude / Perplexity / Gemini cannot cite this page at all.`,
      weight: 0,
      maxWeight: 20,
    });
  }

  // 5. H1 + heading structure
  if (contentStats.h1Count === 1) {
    checks.push({
      id: "headings",
      label: "Single H1 + heading hierarchy",
      status: contentStats.h2Count >= 2 ? "pass" : "warn",
      detail:
        contentStats.h2Count >= 2
          ? `1 H1 + ${contentStats.h2Count} H2 sections — clear hierarchy.`
          : `1 H1 but only ${contentStats.h2Count} H2 sections. Break the article into more sub-topics so LLMs can extract sub-answers.`,
      weight: contentStats.h2Count >= 2 ? 8 : 4,
      maxWeight: 8,
    });
  } else if (contentStats.h1Count === 0) {
    checks.push({
      id: "headings",
      label: "Single H1 + heading hierarchy",
      status: "fail",
      detail: "No H1 found. LLMs use the H1 as the primary topic signal.",
      weight: 0,
      maxWeight: 8,
    });
  } else {
    checks.push({
      id: "headings",
      label: "Single H1 + heading hierarchy",
      status: "warn",
      detail: `${contentStats.h1Count} H1 tags — should be exactly one per page.`,
      weight: 4,
      maxWeight: 8,
    });
  }

  // 6. Paragraph density — short paragraphs are LLM-friendly
  if (contentStats.paragraphCount === 0) {
    checks.push({
      id: "paragraph-density",
      label: "Paragraph density",
      status: "info",
      detail:
        "No <p> tags found — page may be a SPA shell or rely entirely on divs. LLMs prefer semantic paragraphs.",
      weight: 0,
      maxWeight: 5,
    });
  } else if (contentStats.avgParagraphChars > 600) {
    checks.push({
      id: "paragraph-density",
      label: "Paragraph density",
      status: "warn",
      detail: `Average paragraph is ${Math.round(contentStats.avgParagraphChars)} chars. Break into shorter chunks — LLMs prefer 200–400 char paragraphs for cleaner snippet extraction.`,
      weight: 2,
      maxWeight: 5,
    });
  } else {
    checks.push({
      id: "paragraph-density",
      label: "Paragraph density",
      status: "pass",
      detail: `Average paragraph ${Math.round(contentStats.avgParagraphChars)} chars across ${contentStats.paragraphCount} paragraphs — well-chunked.`,
      weight: 5,
      maxWeight: 5,
    });
  }

  // 7. Lists + tables — structured chunks
  const structuredCount = contentStats.listCount + contentStats.tableCount;
  if (structuredCount >= 3) {
    checks.push({
      id: "structured-blocks",
      label: "Structured blocks (lists + tables)",
      status: "pass",
      detail: `${contentStats.listCount} lists + ${contentStats.tableCount} tables — LLMs love structured data to cite verbatim.`,
      weight: 5,
      maxWeight: 5,
    });
  } else {
    checks.push({
      id: "structured-blocks",
      label: "Structured blocks (lists + tables)",
      status: "warn",
      detail: `Only ${structuredCount} structured blocks. Add comparison tables, bulleted breakdowns, step lists.`,
      weight: Math.min(structuredCount * 2, 4),
      maxWeight: 5,
    });
  }

  // 8. FAQ pattern
  const hasFaqSchema = schemas.some((s) => /^FAQPage$/i.test(s.type));
  if (hasFaqSchema) {
    checks.push({
      id: "faq",
      label: "FAQ schema",
      status: "pass",
      detail: "FAQPage schema present — perfect for AI Q&A citations.",
      weight: 5,
      maxWeight: 5,
    });
  } else if (contentStats.hasFaqPattern) {
    checks.push({
      id: "faq",
      label: "FAQ schema",
      status: "warn",
      detail:
        "Q&A pattern detected in content but no FAQPage schema wrapper. Add the schema so LLMs extract questions cleanly.",
      weight: 2,
      maxWeight: 5,
    });
  } else {
    checks.push({
      id: "faq",
      label: "FAQ schema",
      status: "info",
      detail:
        "No FAQ schema or Q&A pattern. Optional — only add if the page has natural questions to answer.",
      weight: 0,
      maxWeight: 5,
    });
  }

  // 9. Citations (outbound links to authoritative sources)
  if (contentStats.outboundLinkCount >= 3) {
    checks.push({
      id: "citations",
      label: "Outbound citations",
      status: "pass",
      detail: `${contentStats.outboundLinkCount} outbound links — credibility signal LLMs reward.`,
      weight: 5,
      maxWeight: 5,
    });
  } else {
    checks.push({
      id: "citations",
      label: "Outbound citations",
      status: "warn",
      detail: `Only ${contentStats.outboundLinkCount} outbound links. Citing authoritative sources raises perceived credibility.`,
      weight: Math.min(contentStats.outboundLinkCount * 2, 4),
      maxWeight: 5,
    });
  }

  // 10. Open Graph + Twitter Card — social previews + AI excerpting
  if (signals.hasOpenGraph && signals.hasTwitterCard) {
    checks.push({
      id: "social-cards",
      label: "Open Graph + Twitter Card",
      status: "pass",
      detail: "Both present. AI engines and social previews extract clean cards.",
      weight: 5,
      maxWeight: 5,
    });
  } else if (signals.hasOpenGraph || signals.hasTwitterCard) {
    checks.push({
      id: "social-cards",
      label: "Open Graph + Twitter Card",
      status: "warn",
      detail: `Only ${signals.hasOpenGraph ? "Open Graph" : "Twitter Card"} present. Add the other for full card coverage.`,
      weight: 3,
      maxWeight: 5,
    });
  } else {
    checks.push({
      id: "social-cards",
      label: "Open Graph + Twitter Card",
      status: "fail",
      detail: "Neither present. AI engines fall back to scraping H1/meta which is less reliable.",
      weight: 0,
      maxWeight: 5,
    });
  }

  // 11. Canonical URL
  checks.push({
    id: "canonical",
    label: "Canonical URL declared",
    status: signals.hasCanonical ? "pass" : "warn",
    detail: signals.hasCanonical
      ? "<link rel=\"canonical\"> present."
      : "No canonical link. AI engines may dedupe against the wrong URL.",
    weight: signals.hasCanonical ? 2 : 0,
    maxWeight: 2,
  });

  // 12. llms.txt — emerging convention
  checks.push({
    id: "llms-txt",
    label: "/llms.txt published",
    status: hasLlmsTxt ? "pass" : "info",
    detail: hasLlmsTxt
      ? "llms.txt found — gives LLMs structured context about your site."
      : "No /llms.txt. Optional but increasingly recognised (emerged late 2024). Add a markdown index of your most-citable pages.",
    weight: hasLlmsTxt ? 5 : 0,
    maxWeight: 5,
  });

  return checks;
}

// ─── Schema extraction ──────────────────────────────────────────────

function extractJsonLdSchemas(html: string): DetectedSchema[] {
  const out: DetectedSchema[] = [];
  // Capture every <script type="application/ld+json">...</script> block.
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) walkSchema(item, out);
    } catch {
      // Some sites embed invalid JSON-LD; skip silently.
    }
  }
  return out;
}

/** Walk a JSON-LD blob, recursing into @graph and nested entities. */
function walkSchema(node: unknown, out: DetectedSchema[]): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (Array.isArray(obj["@graph"])) {
    for (const g of obj["@graph"] as unknown[]) walkSchema(g, out);
    return;
  }
  const typeRaw = obj["@type"];
  const type = Array.isArray(typeRaw) ? String(typeRaw[0]) : String(typeRaw ?? "");
  if (!type) return;

  out.push({
    type,
    hasAuthor:
      obj.author != null && (typeof obj.author === "object" || typeof obj.author === "string"),
    hasDateModified: typeof obj.dateModified === "string",
    hasMainEntityOfPage: obj.mainEntityOfPage != null,
    hasSameAs: Array.isArray(obj.sameAs) && (obj.sameAs as unknown[]).length > 0,
  });
}

// ─── Content stats ──────────────────────────────────────────────────

function computeContentStats(html: string): ContentStats {
  const h1Count = countMatches(html, /<h1\b/gi);
  const h2Count = countMatches(html, /<h2\b/gi);
  const h3Count = countMatches(html, /<h3\b/gi);
  const listCount =
    countMatches(html, /<ul\b/gi) + countMatches(html, /<ol\b/gi);
  const tableCount = countMatches(html, /<table\b/gi);

  // Paragraphs — strip tags inside <p>...</p> and measure char length.
  const paraRe = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  const paraLengths: number[] = [];
  let pm: RegExpExecArray | null;
  while ((pm = paraRe.exec(html)) !== null) {
    const text = stripHtml(pm[1] ?? "").trim();
    if (text.length > 0) paraLengths.push(text.length);
  }
  const paragraphCount = paraLengths.length;
  const avgParagraphChars =
    paragraphCount > 0
      ? paraLengths.reduce((a, b) => a + b, 0) / paragraphCount
      : 0;

  // Rough word count from body text (strip script/style first).
  const bodyText = stripHtml(
    html.replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, ""),
  );
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  // FAQ pattern — look for clusters of question-mark sentences in headings
  // or repeated h2+p alternation.
  const hasFaqPattern =
    /<h[2-4][^>]*>[^<]*\?[^<]*<\/h[2-4]>/i.test(html) ||
    countMatches(
      html,
      /<(?:h[2-4]|button|summary)[^>]*>[^<]{3,120}\?[^<]*<\//gi,
    ) >= 3;

  // Outbound links — count <a href="https://..."> not pointing at the
  // same hostname. We don't know the hostname here without parsing each
  // URL, so we use a heuristic: count all https links and subtract a
  // rough "self" estimate. Imperfect but fast.
  const allHttps = countMatches(html, /<a\b[^>]*href=["']https?:\/\//gi);
  // Rough self-link heuristic: any href starting with /, #, or mailto.
  const internalish = countMatches(
    html,
    /<a\b[^>]*href=["'](?:\/|#|mailto:|tel:)/gi,
  );
  const outboundLinkCount = Math.max(0, allHttps - internalish);

  return {
    h1Count,
    h2Count,
    h3Count,
    paragraphCount,
    avgParagraphChars,
    wordCount,
    listCount,
    tableCount,
    hasFaqPattern,
    outboundLinkCount,
  };
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
}

function countMatches(haystack: string, pattern: RegExp): number {
  let count = 0;
  while (pattern.exec(haystack) !== null) count++;
  pattern.lastIndex = 0;
  return count;
}
