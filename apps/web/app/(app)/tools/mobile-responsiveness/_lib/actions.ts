"use server";

import { requireUser } from "@/lib/auth/session";
import { fetchHtml } from "@/lib/audit/website";
import {
  analyzeMobileFriendliness,
  type MobileFriendlyReport,
} from "@/lib/audit/mobile-friendly";
import {
  captureDeviceShots,
  type DeviceShot,
} from "@/lib/audit/microlink-screenshot";

export type MobileAuditState =
  | {
      ok: true;
      data: {
        report: MobileFriendlyReport;
        shots: DeviceShot[];
        durationMs: number;
      };
    }
  | { ok: false; error: { message: string } };

export async function auditMobileAction(
  rawUrl: string,
): Promise<MobileAuditState> {
  await requireUser();

  const url = normaliseUrl(rawUrl);
  if (!url) {
    return {
      ok: false,
      error: { message: "Enter a valid URL (e.g. https://example.com)." },
    };
  }

  const started = Date.now();

  // Run the HTML probe and the screenshot grid concurrently. The HTML
  // probe lands fast (~1 s); screenshots take 8–20 s each in parallel.
  const [html, shots] = await Promise.all([
    fetchHtml(url, 10_000),
    captureDeviceShots(url),
  ]);

  if (!html) {
    return {
      ok: false,
      error: {
        message:
          "Couldn't fetch the page HTML — site may be down, blocking us, or behind a paywall. Screenshots may have still worked separately.",
      },
    };
  }

  const report = analyzeMobileFriendliness(url, url, html);

  return {
    ok: true,
    data: {
      report,
      shots,
      durationMs: Date.now() - started,
    },
  };
}

function normaliseUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
