"use server";

import { revalidatePath } from "next/cache";
import { createApiKey, revokeApiKey } from "@kit/database/queries";
import { requireUser } from "@/lib/auth/session";
import { generateApiKey } from "@/lib/api/middleware";

type Result<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string } };

export async function createKeyAction(input: {
  name: string;
  permissions: string[];
}): Promise<Result<{ key: string; keyPrefix: string }>> {
  const user = await requireUser();

  const name = input.name.trim();
  if (!name || name.length > 100) {
    return { ok: false, error: { message: "Name is required (max 100 chars)." } };
  }

  const { raw, hash, prefix } = generateApiKey();

  await createApiKey({
    userId: user.id,
    name,
    keyHash: hash,
    keyPrefix: prefix,
    permissions: input.permissions.length > 0 ? input.permissions : ["*"],
  });

  revalidatePath("/settings/api-keys");
  return { ok: true, data: { key: raw, keyPrefix: prefix } };
}

export async function revokeKeyAction(id: string): Promise<Result> {
  const user = await requireUser();

  if (!id) {
    return { ok: false, error: { message: "Missing key ID." } };
  }

  await revokeApiKey(user.id, id);
  revalidatePath("/settings/api-keys");
  return { ok: true, data: undefined };
}
