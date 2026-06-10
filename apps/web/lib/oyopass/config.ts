import { findUserByEmail, createUser } from "@kit/database";
import { env } from "@kit/shared/env";

import { signJwt } from "@/lib/auth/jwt";
import { setAuthCookie } from "@/lib/auth/cookies";

import { createOyoPass } from "./client";

export const oyopass = createOyoPass({
  issuer: env.OYOPASS_ISSUER!,
  clientId: env.OYOPASS_CLIENT_ID!,
  clientSecret: env.OYOPASS_CLIENT_SECRET!,
  appUrl: env.APP_URL,

  async onSuccess(profile) {
    // Upsert local user
    let user = await findUserByEmail(profile.email);

    if (!user) {
      const baseUsername = profile.email
        .split("@")[0]!
        .slice(0, 16)
        .replace(/[^a-zA-Z0-9_-]/g, "");
      const username = `${baseUsername}${Math.random().toString(36).slice(2, 6)}`;

      user = await createUser({
        email: profile.email,
        fullName: profile.name || profile.email.split("@")[0]!,
        username,
        passwordHash: null,
      });
    }

    // Create JWT session
    const jwt = await signJwt({ sub: user.id });
    await setAuthCookie(jwt);

    return "/dashboard";
  },
});
