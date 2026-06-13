import { NextResponse, type NextRequest } from "next/server";
import { withApiKey, handleCorsPreFlight } from "@/lib/api/middleware";

export function OPTIONS() { return handleCorsPreFlight(); }

const AUTO_URL = process.env.AUTOMATION_URL || "http://localhost:3001";
const AUTO_SECRET = process.env.AUTOMATION_SECRET || "dev-secret";

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

    try {
      const resp = await fetch(`${AUTO_URL}/email/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auto-secret": AUTO_SECRET,
        },
        body: JSON.stringify({ emails: raw }),
        signal: AbortSignal.timeout(60_000),
      });

      const data = await resp.json();
      if (!resp.ok) {
        return NextResponse.json(
          { ok: false, error: { code: "VALIDATION_ERROR", message: data.error || "Validation failed" } },
          { status: resp.status },
        );
      }

      return NextResponse.json(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Validation service unavailable";
      return NextResponse.json(
        { ok: false, error: { code: "SERVICE_UNAVAILABLE", message: msg } },
        { status: 503 },
      );
    }
  });
}
