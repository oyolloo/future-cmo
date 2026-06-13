import { NextResponse, type NextRequest } from "next/server";
import { withApiKey, handleCorsPreFlight } from "@/lib/api/middleware";

export function OPTIONS() { return handleCorsPreFlight(); }
import { findEmailsOnWebsite } from "@/lib/audit/email-finder";

export async function POST(req: NextRequest) {
  return withApiKey(req, "email-finder", async () => {
    const body = await req.json().catch(() => null);
    const domain = body?.domain;
    if (!domain || typeof domain !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing 'domain' field" } },
        { status: 400 },
      );
    }

    const result = await findEmailsOnWebsite(domain);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "TOOL_ERROR", message: result.error.message } },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      data: {
        domain: result.data.domain,
        pagesScanned: result.data.pagesScanned,
        emails: result.data.emails.map((e) => ({
          email: e.email,
          confidence: e.confidence,
          sources: e.sources,
        })),
        durationMs: result.data.durationMs,
      },
    });
  });
}
