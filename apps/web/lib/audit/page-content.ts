import "server-only";

export type ExtractedContent = {
  title: string | null;
  metaDescription: string | null;
  /** Cleaned body text — scripts/styles/nav/footer stripped. */
  text: string;
  wordCount: number;
  /** All h1–h3 headings in document order. */
  headings: Array<{ level: 1 | 2 | 3; text: string }>;
};

/**
 * Pull the meaningful textual content out of an HTML page for LLM
 * analysis. Not a full DOM parse — regex-based stripping keeps it fast
 * and dependency-free. Strategy:
 *
 *   1. Drop <script>, <style>, <noscript>, <template>, comments.
 *   2. Drop <nav>, <header>, <footer>, <aside>, common ad/cookie blocks.
 *   3. Prefer <article> or <main> body if present; otherwise <body>.
 *   4. Collapse whitespace + cap total length so we don't ship 50 KB of
 *      text to the LLM (typical LLM-friendly ceiling ~12 K chars).
 */
export function extractContent(html: string): ExtractedContent {
  // Title + meta description first — those metadata fields survive
  // regardless of the body extraction strategy.
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch?.[1] ? decodeEntities(titleMatch[1].trim()) : null;

  const descMatch =
    /<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html) ??
    /<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(html);
  const metaDescription = descMatch?.[1]
    ? decodeEntities(descMatch[1].trim())
    : null;

  // Drop scripts/styles/comments first — these often contain text
  // contaminants that aren't user-facing.
  let working = html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<template[\s\S]*?<\/template>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "");

  // Extract headings BEFORE chrome-stripping so we don't lose H1 in
  // page templates that wrap it in a header/nav.
  const headings = extractHeadings(working);

  // Strip site chrome — nav/header/footer/aside + common cookie/banner
  // classes. Order matters: do this AFTER headings extraction.
  working = working
    .replace(/<header\b[\s\S]*?<\/header>/gi, "")
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, "")
    .replace(
      /<div\b[^>]*class=["'][^"']*(?:cookie|consent|gdpr|newsletter|signup-modal|ad-|advert|sidebar)[^"']*["'][\s\S]*?<\/div>/gi,
      "",
    );

  // Prefer <article> if present (most blog/article pages use it).
  // Fall back to <main>, then <body>, then the cleaned whole.
  const articleMatch = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(working);
  const mainMatch = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(working);
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(working);
  const sourceBlock =
    articleMatch?.[1] ?? mainMatch?.[1] ?? bodyMatch?.[1] ?? working;

  const text = collapseWhitespace(decodeEntities(stripTags(sourceBlock)));
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // Cap the text we hand to the LLM. 12 000 chars ≈ 3 000 tokens — fits
  // comfortably even in modest free models.
  const capped = text.length > 12_000 ? text.slice(0, 12_000) + " …" : text;

  return { title, metaDescription, text: capped, wordCount, headings };
}

// ─── Helpers ────────────────────────────────────────────────────────

function extractHeadings(
  html: string,
): Array<{ level: 1 | 2 | 3; text: string }> {
  const out: Array<{ level: 1 | 2 | 3; text: string }> = [];
  const re = /<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const level = Number(match[1]) as 1 | 2 | 3;
    const text = collapseWhitespace(
      decodeEntities(stripTags(match[2] ?? "")),
    );
    if (text.length > 0) out.push({ level, text });
  }
  return out;
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, " ");
}

function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/** Minimal HTML entity decoder — covers the common ones found on the web. */
function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number.parseInt(n, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(Number.parseInt(n, 16)),
    );
}
