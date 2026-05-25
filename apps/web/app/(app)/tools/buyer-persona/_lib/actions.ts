"use server";

import { revalidatePath } from "next/cache";

import { createSavedPersona, deleteSavedPersona } from "@kit/database";

import { requireUser } from "@/lib/auth/session";
import {
  generatePersonas,
  type PersonaSet,
} from "@/lib/ai/persona-generator";

export type PersonaGenerateState =
  | {
      ok: true;
      data: {
        personas: PersonaSet;
        savedId: string;
        modelUsed: string;
        durationMs: number;
      };
    }
  | { ok: false; error: { message: string } };

export async function generatePersonaAction(input: {
  businessType: string;
  targetMarket: string;
  currentCustomers: string;
  productPrice: string;
}): Promise<PersonaGenerateState> {
  const user = await requireUser();

  if (!input.businessType.trim()) {
    return { ok: false, error: { message: "Describe your business." } };
  }
  if (!input.targetMarket.trim()) {
    return { ok: false, error: { message: "Describe your target market." } };
  }

  const started = Date.now();

  const result = await generatePersonas({
    businessType: input.businessType.trim(),
    targetMarket: input.targetMarket.trim(),
    currentCustomers: input.currentCustomers.trim() || undefined,
    productPrice: input.productPrice.trim() || undefined,
  });

  if (!result.ok) return { ok: false, error: result.error };

  const name = `${input.businessType.slice(0, 40)} · ${new Date().toISOString().slice(0, 10)}`;

  const saved = await createSavedPersona({
    userId: user.id,
    name,
    businessType: input.businessType.trim(),
    targetMarket: input.targetMarket.trim(),
    snapshot: result.data,
  });

  revalidatePath("/tools/buyer-persona");

  return {
    ok: true,
    data: {
      personas: result.data,
      savedId: saved.id,
      modelUsed: result.meta.modelUsed,
      durationMs: Date.now() - started,
    },
  };
}

export async function deletePersonaAction(
  id: string,
): Promise<{ ok: true } | { ok: false; error: { message: string } }> {
  const user = await requireUser();
  await deleteSavedPersona(user.id, id);
  revalidatePath("/tools/buyer-persona");
  return { ok: true };
}
