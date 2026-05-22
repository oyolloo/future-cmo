"use client";

import { Button } from "@kit/ui/button";

import { useLogout } from "@/lib/auth/hooks";

export function LogoutButton() {
  const logout = useLogout();

  return (
    <Button
      variant="outline"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
    >
      {logout.isPending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
