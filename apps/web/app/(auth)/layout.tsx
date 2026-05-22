import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // If already signed in, skip the auth screen.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">future-cmo</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered marketing strategy
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
