import { NextResponse, type NextRequest } from "next/server";
import { withApiKey, handleCorsPreFlight } from "@/lib/api/middleware";

export function OPTIONS() { return handleCorsPreFlight(); }
import { fetchHtml } from "@/lib/audit/website";
import { analyzeAISeo } from "@/lib/audit/ai-seo";
import { fetchRobotsReport, probeLlmsTxt, type RobotsReport } from "@/lib/audit/robots-parser";

export async function POST(req: NextRequest) {
  return withApiKey(req, "seo-ai", async () => {
    const body = await req.json().catch(() => null);
    const rawUrl = body?.url;
    if (!rawUrl || typeof rawUrl !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing 'url' field" } },
        { status: 400 },
      );
    }

    const url = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
    let domain: string;
    try {
      domain = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Invalid URL" } },
        { status: 400 },
      );
    }

    const html = await fetchHtml(url, 12_000);
    if (!html) {
      return NextResponse.json(
        { ok: false, error: { code: "TOOL_ERROR", message: "Could not fetch page HTML" } },
        { status: 502 },
      );
    }

    const [robotsResult, hasLlmsTxt] = await Promise.all([
      fetchRobotsReport(domain).catch(() => null),
      probeLlmsTxt(domain).catch(() => false),
    ]);

    const report = analyzeAISeo(
      url,
      url,
      html,
      robotsResult?.report ?? ({} as RobotsReport),
      hasLlmsTxt,
    );

    return NextResponse.json({
      ok: true,
      data: {
        verdict: { score: report.score, band: report.band },
        report: report.checks,
        signals: report.signals,
        botAccess: report.botAccess,
        hasLlmsTxt: report.hasLlmsTxt,
      },
    });
  });
}
