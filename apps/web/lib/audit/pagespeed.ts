import "server-only";

import { env } from "@kit/shared/env";

const ENDPOINT =
  "https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed";

/**
 * Call Google PageSpeed Insights (free, key-restricted to the same Maps
 * Platform project — PageSpeed Insights API must be enabled separately
 * in Google Cloud Console).
 *
 * Returns the mobile performance score 0–100, or null on any failure /
 * timeout / disabled API. Audit pipeline treats null gracefully — the
 * "Website Performance" section just shows 0% rather than crashing the
 * whole report.
 *
 * PageSpeed is slow (4–8 seconds typical). We cap at 12s and rely on the
 * 24-hour audit cache to absorb the latency on repeat report opens.
 */
export async function getPagespeedScore(url: string): Promise<number | null> {
  const key = env.GOOGLE_MAPS_API_KEY;
  if (!key || key.length < 30) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);

    const target = new URL(ENDPOINT);
    target.searchParams.set("url", url);
    target.searchParams.set("strategy", "mobile");
    target.searchParams.set("category", "performance");
    target.searchParams.set("key", key);

    const res = await fetch(target, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!res.ok) return null;

    const data = (await res.json()) as {
      lighthouseResult?: {
        categories?: { performance?: { score?: number } };
      };
    };
    const raw = data?.lighthouseResult?.categories?.performance?.score;
    if (typeof raw !== "number") return null;
    return Math.round(raw * 100);
  } catch {
    return null;
  }
}
