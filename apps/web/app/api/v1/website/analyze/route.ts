import { NextResponse, type NextRequest } from "next/server";
import { withApiKey } from "@/lib/api/middleware";
import { fetchHtml } from "@/lib/audit/website";
import { extractSocialLinks } from "@/lib/intel/social-extractor";

export async function POST(req: NextRequest) {
  return withApiKey(req, "website-analyze", async () => {
    const body = await req.json().catch(() => null);
    const url = body?.url;
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing 'url' field" } },
        { status: 400 },
      );
    }

    const fullUrl = url.startsWith("http") ? url : `https://${url}`;
    const html = await fetchHtml(fullUrl, 10_000);
    if (!html) {
      return NextResponse.json(
        { ok: false, error: { code: "TOOL_ERROR", message: "Could not fetch page HTML" } },
        { status: 502 },
      );
    }

    const links = extractSocialLinks(html);
    const socialLinks: Record<string, string> = {};
    for (const link of links) {
      if (!socialLinks[link.platform]) {
        socialLinks[link.platform] = link.url;
      }
    }

    return NextResponse.json({
      ok: true,
      data: { socialLinks },
    });
  });
}
