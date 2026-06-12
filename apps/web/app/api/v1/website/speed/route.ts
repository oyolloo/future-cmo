import { NextResponse, type NextRequest } from "next/server";
import { withApiKey } from "@/lib/api/middleware";
import { getPagespeedScore } from "@/lib/audit/pagespeed";

export async function POST(req: NextRequest) {
  return withApiKey(req, "pagespeed", async () => {
    const body = await req.json().catch(() => null);
    const url = body?.url;
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing 'url' field" } },
        { status: 400 },
      );
    }

    const score = await getPagespeedScore(url);

    return NextResponse.json({
      ok: true,
      data: {
        performanceScore: score,
        metrics: null,
      },
    });
  });
}
