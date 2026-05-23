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
    <div className="relative isolate flex min-h-screen items-center justify-center px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(50%_50%_at_50%_0%,oklch(0.70_0.16_50/0.15),transparent_70%)]"
      />

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2">
            <span className="size-2 rounded-sm bg-primary" />
            <span className="font-mono text-sm tracking-tight">future-cmo</span>
          </div>
          <p className="text-label mt-3">— workspace access</p>
        </div>
        {children}
      </div>
    </div>
  );
}
