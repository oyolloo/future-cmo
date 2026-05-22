"use server";

import { setAuthCookie } from "@/lib/auth/cookies";
import { isAuthError } from "@/lib/auth/errors";
import { stripPasswordHash, type PublicUser } from "@/lib/auth/session";

import { registerSchema } from "./schema";
import { registerUser } from "./service";

export type RegisterActionState =
  | { ok: true; user: PublicUser }
  | { ok: false; error: { code: string; message: string } };

export async function registerAction(
  formData: FormData,
): Promise<RegisterActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: parsed.error.issues[0]?.message ?? "Invalid input",
      },
    };
  }

  try {
    const { user, token } = await registerUser(parsed.data);
    await setAuthCookie(token);
    return { ok: true, user: stripPasswordHash(user) };
  } catch (err) {
    if (isAuthError(err)) {
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    throw err;
  }
}
