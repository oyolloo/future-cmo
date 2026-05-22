import { requireUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side guard. Throws via redirect("/sign-in") if no session.
  // getCurrentUser is React.cache-d, so the child page can re-fetch without
  // an extra DB round-trip.
  await requireUser();

  return <div className="min-h-screen">{children}</div>;
}
