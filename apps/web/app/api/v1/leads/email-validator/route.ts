import { NextResponse, type NextRequest } from "next/server";
import { withApiKey, handleCorsPreFlight } from "@/lib/api/middleware";

export function OPTIONS() { return handleCorsPreFlight(); }
import { promises as dns } from "node:dns";

export async function POST(req: NextRequest) {
  return withApiKey(req, "email-validator", async () => {
    const body = await req.json().catch(() => null);
    const raw = body?.emails;
    if (!raw || typeof raw !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_REQUEST", message: "Missing 'emails' field (comma-separated)" } },
        { status: 400 },
      );
    }

    const emails = raw
      .split(",")
      .map((e: string) => e.trim())
      .filter(Boolean);

    const results = await Promise.all(
      emails.map(async (email: string) => {
        const domain = email.split("@")[1];
        if (!domain) return { email, valid: false };
        try {
          const mx = await dns.resolveMx(domain);
          return { email, valid: mx.length > 0 };
        } catch {
          return { email, valid: false };
        }
      }),
    );

    return NextResponse.json({ ok: true, data: { results } });
  });
}
