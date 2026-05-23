"use client";

import {
  BarChart3,
  BookOpen,
  FileEdit,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Megaphone,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@kit/ui/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
  shortcut?: string;
};

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/gm-prospecting", label: "GM Prospecting", icon: MapPin },
  { href: "/library", label: "Library", icon: BookOpen },
  { href: "/strategies", label: "Strategies", icon: ListChecks, soon: true },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone, soon: true },
  { href: "/content", label: "Content", icon: FileEdit, soon: true },
  { href: "/insights", label: "Insights", icon: BarChart3, soon: true },
  { href: "/ai", label: "Claude", icon: Sparkles, soon: true },
];

const workspaceNav: NavItem[] = [
  { href: "/search", label: "Search", icon: Search, shortcut: "⌘K", soon: true },
  { href: "/settings", label: "Settings", icon: Settings, soon: true },
];

/**
 * Desktop static sidebar — hidden below `md` (where the Topbar surfaces a
 * hamburger button that opens the same nav in a Sheet drawer).
 */
export function Sidebar() {
  return (
    <aside
      data-print-hide
      className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-card md:flex"
    >
      <SidebarContent />
    </aside>
  );
}

/**
 * The nav content itself — extracted so the desktop <Sidebar> and the
 * mobile drawer (in Topbar) can share the same layout/links without
 * duplicating the data. The mobile drawer passes `onNavigate` so a link
 * click closes the Sheet before the route transition.
 */
export function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
} = {}) {
  const pathname = usePathname();

  return (
    <>
      {/* brand — matches topbar height (h-14) so dividers align */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-5">
        <span className="size-2 rounded-sm bg-primary" />
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-sm tracking-tight text-foreground">
            future-cmo
          </span>
          <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground">
            v 0.1 · alpha
          </span>
        </div>
      </div>

      {/* main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        <ul className="space-y-0.5">
          {mainNav.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </ul>

        <div className="mt-8 px-3">
          <p className="text-label">workspace</p>
        </div>
        <ul className="mt-2 space-y-0.5">
          {workspaceNav.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>

      <div className="border-t border-border px-5 py-4">
        <p className="font-mono text-[0.625rem] text-muted-foreground">
          marketing strategy desk
        </p>
      </div>
    </>
  );
}

function SidebarItem({
  item,
  pathname,
  onNavigate,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = pathname === item.href || pathname.startsWith(item.href + "/");

  if (item.soon) {
    return (
      <li>
        <span
          className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground/55"
          aria-disabled
        >
          <Icon className="size-4" />
          <span>{item.label}</span>
          <span className="ml-auto font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground/45">
            soon
          </span>
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
          active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <Icon className="size-4" />
        <span>{item.label}</span>
        {item.shortcut ? (
          <kbd className="ml-auto rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
            {item.shortcut}
          </kbd>
        ) : null}
      </Link>
    </li>
  );
}
