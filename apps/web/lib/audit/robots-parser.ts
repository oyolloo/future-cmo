import "server-only";

import { AI_BOTS, type RobotsReport, type BotAccess } from "./ai-bots";

export type { BotAccess, RobotsReport, AIBot } from "./ai-bots";
export { AI_BOTS } from "./ai-bots";

/**
 * Fetch + parse robots.txt for a domain. Returns the access ruling per
 * known AI bot. Network/parse failures degrade to `no-rule` for every
 * bot so the audit can still produce a score.
 */
export async function fetchRobotsReport(domain: string): Promise<{
  url: string;
  fetched: boolean;
  report: RobotsReport;
  /** True when no robots.txt at all — implicitly allows everything. */
  noRobotsTxt: boolean;
}> {
  const url = `https://${domain}/robots.txt`;
  const empty = makeEmptyReport();

  let raw: string | null = null;
  let noRobotsTxt = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/plain" },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (res.status === 404) {
      noRobotsTxt = true;
    } else if (res.ok) {
      raw = await res.text();
    }
  } catch {
    return { url, fetched: false, report: empty, noRobotsTxt: false };
  }

  if (noRobotsTxt) {
    // No robots.txt = all bots allowed (RFC 9309 default).
    const allow = makeEmptyReport();
    for (const bot of AI_BOTS) allow[bot] = "allow";
    return { url, fetched: true, report: allow, noRobotsTxt: true };
  }

  if (!raw) {
    return { url, fetched: false, report: empty, noRobotsTxt: false };
  }

  return {
    url,
    fetched: true,
    report: parseRobotsTxt(raw),
    noRobotsTxt: false,
  };
}

/**
 * Cheap robots.txt parser — only cares about the AI_BOTS list. For each
 * `User-agent: X` group, collects `Disallow:` lines and decides:
 *   - any `Disallow: /` → "disallow"
 *   - all `Disallow:` empty or scoped to subpaths → "allow"
 *   - bot not mentioned → "no-rule" (falls back to `*` group if present)
 */
function parseRobotsTxt(text: string): RobotsReport {
  const report = makeEmptyReport();

  // Split into UA groups. Lines starting with `#` are comments.
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  // Group state: current UAs + accumulated disallows.
  type Group = { uas: string[]; disallows: string[]; allows: string[] };
  const groups: Group[] = [];
  let current: Group | null = null;

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const value = line.slice(colonIdx + 1).trim();

    if (key === "user-agent") {
      // Consecutive User-agent lines belong to the same group; starting
      // a new directive line closes the previous group.
      if (!current || current.disallows.length || current.allows.length) {
        current = { uas: [value], disallows: [], allows: [] };
        groups.push(current);
      } else {
        current.uas.push(value);
      }
    } else if (key === "disallow" && current) {
      current.disallows.push(value);
    } else if (key === "allow" && current) {
      current.allows.push(value);
    }
  }

  const wildcard = groups.find((g) =>
    g.uas.some((u) => u === "*"),
  );

  for (const bot of AI_BOTS) {
    const specific = groups.find((g) =>
      g.uas.some((u) => u.toLowerCase() === bot.toLowerCase()),
    );
    const applied = specific ?? wildcard;
    if (!applied) {
      report[bot] = "no-rule";
      continue;
    }
    report[bot] = evaluateGroup(applied);
  }

  return report;
}

function evaluateGroup(group: { disallows: string[]; allows: string[] }): BotAccess {
  // Any `Disallow: /` blocks the whole site.
  if (group.disallows.some((d) => d === "/")) return "disallow";
  // Empty `Disallow:` is the "allow everything" signal.
  if (
    group.disallows.length === 0 ||
    group.disallows.every((d) => d === "")
  ) {
    return "allow";
  }
  // Otherwise the bot is allowed to crawl outside the disallowed
  // subpaths — for our purposes that counts as "allow".
  return "allow";
}

function makeEmptyReport(): RobotsReport {
  const r = {} as RobotsReport;
  for (const bot of AI_BOTS) r[bot] = "no-rule";
  return r;
}

/**
 * Probe `/llms.txt` presence — newer convention (since late 2024) for
 * giving LLMs structured context about a site. Just a HEAD request;
 * we don't fetch the content for the AI SEO audit.
 */
export async function probeLlmsTxt(domain: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://${domain}/llms.txt`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "text/plain, text/markdown" },
      cache: "no-store",
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
