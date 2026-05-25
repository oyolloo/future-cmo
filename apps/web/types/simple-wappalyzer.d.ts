/**
 * `simple-wappalyzer` ships CommonJS with no type definitions. The full
 * runtime shape is captured in our wrapper at lib/audit/tech-detector.ts —
 * this module declaration just unblocks the import.
 *
 * Note: simple-wappalyzer's README documents a `{ urls, applications, meta }`
 * wrapper, but the current runtime (1.1.x) returns the flat array from
 * wappalyzer-core's `resolve()` directly. Trust the wrapper code, not the
 * README.
 */
declare module "simple-wappalyzer" {
  type WappalyzerCategory = {
    id: number;
    name: string;
    priority?: number;
  };

  type WappalyzerApplication = {
    name: string;
    description?: string;
    slug?: string;
    categories: WappalyzerCategory[];
    confidence: number;
    version: string | null;
    icon: string | null;
    website: string | null;
    pricing?: string[];
    cpe: string | null;
    rootPath?: boolean;
    lastUrl?: string;
  };

  type WappalyzerInput = {
    url: string;
    headers: Record<string, string | string[]>;
    html: string;
    statusCode?: number;
  };

  const wappalyzer: (input: WappalyzerInput) => Promise<WappalyzerApplication[]>;
  export default wappalyzer;
}
