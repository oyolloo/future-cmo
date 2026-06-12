import { NextResponse, type NextRequest } from "next/server";
import { withApiKey } from "@/lib/api/middleware";
import { detectTechnologies } from "@/lib/audit/tech-detector";

export async function POST(req: NextRequest) {
  return withApiKey(req, "tech-detector", async () => {
    const body = await req.json().catch(() => null);
    const url = body?.url;
    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing 'url' field" } },
        { status: 400 },
      );
    }

    const result = await detectTechnologies(url);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "TOOL_ERROR", message: `Detection failed: ${result.error.kind}` } },
        { status: 502 },
      );
    }

    const technologies = result.data.detected.map((d) => ({
      name: d.name,
      category: d.categories[0] ?? "other",
    }));

    return NextResponse.json({ ok: true, data: { technologies } });
  });
}
