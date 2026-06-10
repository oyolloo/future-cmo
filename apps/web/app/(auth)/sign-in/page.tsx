import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@kit/ui/card";

import { LoginForm } from "./_components/login-form";

export const metadata = {
  title: "Sign in · future-cmo",
};

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "Invalid link — no token found.",
  expired_token: "This link is expired or already used. Request a new one.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to your account</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && ERROR_MESSAGES[error] ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
            {ERROR_MESSAGES[error]}
          </p>
        ) : null}
        <LoginForm />
        <p className="text-center text-sm text-muted-foreground">
          New here? Just enter your email — we&apos;ll create your account automatically.
        </p>
      </CardContent>
    </Card>
  );
}
