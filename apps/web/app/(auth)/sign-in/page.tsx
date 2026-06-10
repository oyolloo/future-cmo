import { Card, CardContent, CardHeader, CardTitle } from "@kit/ui/card";

import { LoginForm } from "./_components/login-form";

export const metadata = {
  title: "Sign in · future-cmo",
};

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "Invalid link — no token found.",
  expired_token: "This link is expired or already used. Request a new one.",
  access_denied: "You don't have access to this app. Ask your admin to grant you a role.",
  token_exchange_failed: "OyoPass sign-in failed. Please try again.",
  invalid_state: "Security check failed. Please try signing in again.",
  sso_not_configured: "OyoPass SSO is not fully configured.",
  missing_params: "Invalid callback — missing parameters.",
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
      </CardContent>
    </Card>
  );
}
