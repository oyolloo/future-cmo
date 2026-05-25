"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@kit/ui/button";
import { LogoutIcon as LogOut, MenuIcon as Menu } from "@kit/ui/icons";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@kit/ui/sheet";

import { useLogout } from "@/lib/auth/hooks";

import { SidebarContent } from "./sidebar";

export type TopbarUser = {
  username: string;
  email: string;
};

export function Topbar({ user }: { user: TopbarUser }) {
  const pathname = usePathname();
  const logout = useLogout();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const segments = pathname.split("/").filter(Boolean);
  const current = segments[segments.length - 1] ?? "dashboard";

  return (
    <header
      data-print-hide
      className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/75 sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-2">
        {/* Mobile nav trigger — opens sidebar in a drawer below md */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Open navigation"
              className="md:hidden"
            >
              <Menu className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>

        <div className="flex min-w-0 items-center gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="hidden sm:inline">workspace</span>
          <span className="hidden text-muted-foreground/40 sm:inline">/</span>
          <span className="truncate text-foreground">{current}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="flex size-7 items-center justify-center rounded-md border border-border bg-muted font-mono text-[0.625rem] uppercase tracking-wider text-foreground"
            aria-hidden
          >
            {user.username.slice(0, 2)}
          </div>
          <div className="hidden min-w-0 flex-col leading-tight md:flex">
            <span className="truncate font-mono text-xs text-foreground">
              {user.username}
            </span>
            <span className="truncate font-mono text-[0.625rem] text-muted-foreground">
              {user.email}
            </span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          aria-label="Sign out"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">
            {logout.isPending ? "Signing out…" : "Sign out"}
          </span>
        </Button>
      </div>
    </header>
  );
}
