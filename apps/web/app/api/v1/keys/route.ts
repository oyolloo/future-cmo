import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { generateApiKey } from "@/lib/api/middleware";
import { createApiKey, listApiKeysByUser, revokeApiKey } from "@kit/database/queries";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 },
    );
  }

  const keys = await listApiKeysByUser(user.id);
  return NextResponse.json({
    keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      permissions: k.permissions,
      rateLimit: k.rateLimit,
      active: k.active,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const name = body?.name;
  if (!name || typeof name !== "string" || name.length > 100) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Missing or invalid 'name' field" } },
      { status: 400 },
    );
  }

  const permissions: string[] = Array.isArray(body?.permissions) ? body.permissions : ["*"];
  const { raw, hash, prefix } = generateApiKey();

  const apiKey = await createApiKey({
    userId: user.id,
    name,
    keyHash: hash,
    keyPrefix: prefix,
    permissions,
  });

  return NextResponse.json({
    id: apiKey.id,
    name: apiKey.name,
    key: raw,
    keyPrefix: prefix,
    permissions: apiKey.permissions,
    createdAt: apiKey.createdAt,
  });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id || typeof id !== "string") {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Missing 'id' field" } },
      { status: 400 },
    );
  }

  await revokeApiKey(user.id, id);
  return NextResponse.json({ ok: true });
}
