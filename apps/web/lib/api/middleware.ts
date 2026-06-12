import "server-only";

import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { findApiKeyByHash, touchApiKeyUsage } from "@kit/database/queries";
import type { ApiKey } from "@kit/database/schema";

export type ApiContext = {
  apiKey: ApiKey;
  userId: string;
};

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = "fcmo_" + Buffer.from(bytes).toString("base64url");
  return { raw, hash: hashKey(raw), prefix: raw.slice(0, 12) };
}

export async function withApiKey(
  req: NextRequest,
  permission: string,
  handler: (ctx: ApiContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Missing API key" } },
      { status: 401 },
    );
  }

  const raw = auth.slice(7);
  if (!raw.startsWith("fcmo_")) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid API key format" } },
      { status: 401 },
    );
  }

  const hash = hashKey(raw);
  const apiKey = await findApiKeyByHash(hash);

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: { code: "UNAUTHORIZED", message: "Invalid or revoked API key" } },
      { status: 401 },
    );
  }

  if (apiKey.permissions.length > 0 && !apiKey.permissions.includes(permission) && !apiKey.permissions.includes("*")) {
    return NextResponse.json(
      { ok: false, error: { code: "FORBIDDEN", message: `Missing permission: ${permission}` } },
      { status: 403 },
    );
  }

  touchApiKeyUsage(apiKey.id).catch(() => {});

  return handler({ apiKey, userId: apiKey.userId });
}
