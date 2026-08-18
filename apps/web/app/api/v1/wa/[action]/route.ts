import { NextResponse, type NextRequest } from "next/server";
import { withApiKey, handleCorsPreFlight } from "@/lib/api/middleware";

/**
 * Public edge for the WhatsApp channel.
 *
 * The automation server holds the Baileys sessions, but it listens on
 * localhost:3001 inside this container and has no domain of its own — so
 * anything outside the container, OyoLeads included, cannot reach it. This
 * forwards over the same loopback the email-validator route already uses,
 * which keeps the automation server unexposed and its shared secret on this
 * side of the wall.
 *
 * Actions are whitelisted. A pass-through path would turn an internal service
 * guarded by a static secret into an open relay.
 */

export function OPTIONS() { return handleCorsPreFlight(); }

const AUTO_URL = process.env.AUTOMATION_URL || "http://localhost:3001";
const AUTO_SECRET = process.env.AUTOMATION_SECRET || "dev-secret";

// "exists" asks whether numbers are on WhatsApp. Read-only, but it is
// still a whitelist entry rather than a pass-through: the automation server
// behind this is guarded only by a static secret.
const POST_ACTIONS = new Set(["connect", "disconnect", "send", "exists"]);

async function forward(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<NextResponse> {
  try {
    const resp = await fetch(`${AUTO_URL}${path}`, {
      method: init.method,
      headers: { "Content-Type": "application/json", "x-auto-secret": AUTO_SECRET },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      // Connecting waits on Baileys' handshake, which is not instant.
      signal: AbortSignal.timeout(45_000),
    });
    const data = await resp.json().catch(() => null);
    if (data == null) {
      return NextResponse.json(
        { ok: false, error: { code: "BAD_GATEWAY", message: "Automation server returned no data" } },
        { status: 502 },
      );
    }
    return NextResponse.json(data, { status: resp.ok ? 200 : resp.status });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: timedOut ? "TIMEOUT" : "UNAVAILABLE",
          message: timedOut ? "Automation server timed out" : "Automation server unreachable",
        },
      },
      { status: timedOut ? 504 : 503 },
    );
  }
}

/** Status is the only read, and it carries the QR while one is pending. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return withApiKey(req, "wa", async () => {
    if (action !== "status") {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: `No GET action '${action}'` } },
        { status: 404 },
      );
    }
    const wsId = req.nextUrl.searchParams.get("workspace_id") || "default";
    return forward(`/wa/status/${encodeURIComponent(wsId)}`, { method: "GET" });
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params;
  return withApiKey(req, "wa", async () => {
    if (!POST_ACTIONS.has(action)) {
      return NextResponse.json(
        { ok: false, error: { code: "NOT_FOUND", message: `No POST action '${action}'` } },
        { status: 404 },
      );
    }
    const body = await req.json().catch(() => ({}));
    return forward(`/wa/${action}`, { method: "POST", body });
  });
}
