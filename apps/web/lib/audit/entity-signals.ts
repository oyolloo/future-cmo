import "server-only";

export type EntitySignal = {
  /** Display name from `name`, `legalName`, or `headline`. */
  name: string;
  /** JSON-LD @type (e.g. Organization, Person, Product, LocalBusiness). */
  type: string;
  /** Outbound URLs declared in `sameAs` — Wikipedia / Wikidata / social. */
  sameAs: string[];
  /** Has identifier / @id pointing at an authoritative source. */
  hasIdentifier: boolean;
};

/**
 * Pull explicit entity signals from JSON-LD blocks on a page. Entity SEO
 * scoring depends heavily on these — sameAs URLs, Organization markup,
 * and @id references tell search engines + LLMs which named entity in
 * their knowledge graph this page is talking about.
 *
 * Returns a flat list — nested @graph + entities-within-entities are
 * walked recursively so a single complex JSON-LD block can contribute
 * multiple signals.
 */
export function extractEntitySignals(html: string): EntitySignal[] {
  const out: EntitySignal[] = [];
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as unknown;
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) walk(item, out);
    } catch {
      // Skip invalid JSON-LD silently.
    }
  }
  return out;
}

function walk(node: unknown, out: EntitySignal[]): void {
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;

  // @graph wrapper — recurse into children, don't emit a row for the
  // wrapper itself.
  if (Array.isArray(obj["@graph"])) {
    for (const g of obj["@graph"] as unknown[]) walk(g, out);
    return;
  }

  const typeRaw = obj["@type"];
  const type = Array.isArray(typeRaw)
    ? String(typeRaw[0])
    : String(typeRaw ?? "");
  if (!type) return;

  const sameAsRaw = obj.sameAs;
  const sameAs = Array.isArray(sameAsRaw)
    ? sameAsRaw.filter((s): s is string => typeof s === "string")
    : typeof sameAsRaw === "string"
      ? [sameAsRaw]
      : [];

  const name =
    pickString(obj.name) ??
    pickString(obj.legalName) ??
    pickString(obj.headline) ??
    "";

  // Some properties hold nested entities — recurse into them so we
  // capture e.g. Article > author (Person) > publisher (Organization).
  const nestedKeys = [
    "author",
    "publisher",
    "creator",
    "provider",
    "brand",
    "mentions",
    "about",
    "subjectOf",
  ];
  for (const key of nestedKeys) {
    const value = obj[key];
    if (Array.isArray(value)) {
      for (const v of value) walk(v, out);
    } else if (value && typeof value === "object") {
      walk(value, out);
    }
  }

  if (!name) return; // Skip un-named blobs (e.g. WebSite roots with only @id).

  out.push({
    name,
    type,
    sameAs,
    hasIdentifier:
      typeof obj["@id"] === "string" && (obj["@id"] as string).length > 0,
  });
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}
