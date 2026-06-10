import { redirect } from "next/navigation";

import {
  createSession,
  createUser,
  findUserByEmail,
  findValidMagicLinkToken,
  markMagicLinkTokenUsed,
} from "@kit/database";
import { env } from "@kit/shared/env";

import { setAuthCookie } from "@/lib/auth/cookies";
import { signJwt } from "@/lib/auth/jwt";

export const metadata = {
  title: "Verifying · future-cmo",
};

export default async function VerifyMagicLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <ErrorView message="Missing token. Check the link in your email." />;
  }

  // 1. Find + validate token
  const row = await findValidMagicLinkToken(token);
  if (!row) {
    return <ErrorView message="This link is expired or already used. Request a new one." />;
  }

  // 2. Mark as used (one-time)
  await markMagicLinkTokenUsed(token);

  // 3. Find or create user
  const email = row.email.toLowerCase();
  let user = await findUserByEmail(email);

  if (!user) {
    // Auto-create on first magic link sign-in
    const username = email.split("@")[0]!.replace(/[^a-z0-9._-]/gi, "").slice(0, 20);
    const fullName = username;
    user = await createUser({
      username,
      email,
      fullName,
      passwordHash: null,
    });
  }

  // 4. Create session
  const jwt = await signJwt({ sub: user.id });
  const expiresAt = new Date(Date.now() + env.SESSION_MAX_AGE * 1000);
  await createSession({ userId: user.id, token: jwt, expiresAt });
  await setAuthCookie(jwt);

  // 5. Redirect to dashboard
  redirect("/dashboard");
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <p className="text-label">— verification failed</p>
        <h1 className="mt-3 text-xl font-semibold text-foreground">
          {message}
        </h1>
        <a
          href="/sign-in"
          className="mt-6 inline-block rounded-md bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground"
        >
          Back to sign in
        </a>
      </div>
    </div>
  );
}
