"use server";

import { setAuthCookie } from "@/lib/auth/cookies";
import { isAuthError } from "@/lib/auth/errors";
import { stripPasswordHash, type PublicUser } from "@/lib/auth/session";

import { loginSchema } from "./schema";
import { loginUser } from "./service";

export type LoginActionState =
  | { ok: true; user: PublicUser }
  | { ok: false; error: { code: string; message: string } };

export async function loginAction(
  formData: FormData,
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "on",
  });
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
    const { user, token } = await loginUser(parsed.data);
    await setAuthCookie(token);
    return { ok: true, user: stripPasswordHash(user) };
  } catch (err) {
    if (isAuthError(err)) {
      return { ok: false, error: { code: err.code, message: err.message } };
    }
    throw err;
  }
}
