"use server";

import { requireUser } from "@/lib/auth/session";
import {
  detectTechnologies,
  type TechDetectionError,
  type TechDetectionResult,
} from "@/lib/audit/tech-detector";

export type DetectActionState =
  | { ok: true; data: TechDetectionResult }
  | { ok: false; error: { message: string } };

export async function detectAction(url: string): Promise<DetectActionState> {
  await requireUser();

  const result = await detectTechnologies(url);
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, error: { message: errorMessage(result.error) } };
}

function errorMessage(error: TechDetectionError): string {
  switch (error.kind) {
    case "invalid_url":
      return "Enter a valid URL (e.g. https://example.com).";
    case "dns_not_found":
      return `The domain "${error.host}" doesn't resolve — check the spelling or confirm the site still exists.`;
    case "connection_refused":
      return `${error.host} is online but refused the connection — the server is down or not accepting traffic on this port.`;
    case "connection_reset":
      return `${error.host} accepted then dropped the connection mid-handshake — site may be misconfigured or rate-limiting our IP.`;
    case "connection_timeout":
      return `${error.host} didn't respond in time — the server is unreachable or behind a strict firewall.`;
    case "ssl_error":
      return `${error.host} has an SSL/TLS issue: ${error.detail}. The certificate may be expired, self-signed, or mismatched.`;
    case "http_error":
      if (error.status === 403)
        return "The site returned 403 — likely a bot-protection wall (Cloudflare / Akamai). Try the URL in a regular browser to confirm it's reachable.";
      if (error.status === 404)
        return "404 Not Found — the URL exists no longer or has moved.";
      if (error.status === 503)
        return "503 Service Unavailable — the server is overloaded or in maintenance mode.";
      if (error.status >= 500)
        return `Server returned ${error.status} ${error.statusText} — the site is having problems right now.`;
      return `Server returned ${error.status} ${error.statusText}.`;
    case "non_html":
      return `That URL returned ${error.contentType || "non-HTML content"} — give us an HTML page (the homepage usually works best).`;
    case "timeout":
      return "Fetch timed out after 15 s. The site may be slow or blocking automated requests.";
    case "fetch_failed":
      return error.code
        ? `Network error (${error.code}): ${error.message}`
        : `Network error: ${error.message}`;
    case "analyze_failed":
      return `Analysis failed: ${error.message}`;
  }
}
