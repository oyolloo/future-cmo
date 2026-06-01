"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import {
  ActivityIcon as Activity,
  BarChartIcon as BarChart3,
  BeakerIcon as Beaker,
  ChevronDownIcon as ChevronDown,
  CircleArrowUpIcon as CircleArrowUp,
  CodeIcon as Code2,
  DashboardIcon as LayoutDashboard,
  FileEditIcon as FileEdit,
  FileTextIcon as FileText,
  MagicWandIcon as MagicWand,
  GaugeIcon as Gauge,
  GlobeIcon as Globe,
  LibraryIcon as BookOpen,
  LinkIcon as Link2,
  ListChecksIcon as ListChecks,
  MapPinIcon as MapPin,
  MegaphoneIcon as Megaphone,
  MousePointerIcon as MousePointer2,
  NetworkIcon as Network,
  RocketIcon as Rocket,
  SearchIcon as Search,
  SettingsIcon as Settings,
  ShoppingCartIcon as ShoppingCart,
  SmartphoneIcon as Smartphone,
  SparklesIcon as Sparkles,
  StoreIcon as Store,
  TargetIcon as Target,
} from "@kit/ui/icons";

import { cn } from "@kit/ui/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────

type NavLeaf = {
  href: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  soon?: boolean;
  shortcut?: string;
};

type NavSubgroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavLeaf[];
};

type NavCategory = {
  id: string;
  label: string;
  subgroups: NavSubgroup[];
};

// ─── Data ──────────────────────────────────────────────────────────────
// Top-level pinned items (no category — always visible at the top).
const pinnedNav: NavLeaf[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/library", label: "Library", icon: BookOpen },
];

const categories: NavCategory[] = [
  {
    id: "lead-generate",
    label: "Lead Generate",
    subgroups: [
      {
        id: "gmb",
        label: "Google My Business",
        icon: MapPin,
        items: [
          { href: "/gm-prospecting", label: "GM Prospecting", icon: Store },
          {
            href: "/gm-prospecting/reports",
            label: "Reports",
            icon: FileText,
          },
        ],
      },
      {
        id: "outreach",
        label: "Outreach",
        icon: Megaphone,
        items: [
          {
            href: "/tools/email-finder",
            label: "Email Finder",
            icon: Globe,
          },
          {
            href: "/tools/email-validator",
            label: "Email Validator",
            icon: ListChecks,
          },
        ],
      },
    ],
  },
  {
    id: "website-digital",
    label: "Web & Digital",
    subgroups: [
      {
        id: "website-foundations",
        label: "Website Foundations",
        icon: Globe,
        items: [
          {
            href: "/tools/domain-hosting",
            label: "Domain & Hosting",
            icon: Globe,
          },
          {
            href: "/tools/website-speed",
            label: "Website Speed",
            icon: Gauge,
          },
          {
            href: "/tools/mobile-responsiveness",
            label: "Mobile Responsiveness",
            icon: Smartphone,
          },
          {
            href: "/tools/cms-detector",
            label: "CMS Detector",
            icon: Code2,
          },
        ],
      },
      {
        id: "advanced-seo",
        label: "Advanced SEO",
        icon: Sparkles,
        items: [
          {
            href: "/tools/ai-seo",
            label: "AI SEO",
            icon: Sparkles,
          },
          {
            href: "/tools/geo",
            label: "GEO",
            icon: Sparkles,
          },
          {
            href: "/tools/semantic-seo",
            label: "Semantic SEO",
            icon: Network,
          },
          {
            href: "/tools/entity-seo",
            label: "Entity SEO",
            icon: Network,
          },
          {
            href: "/tools/topical-authority",
            label: "Topical Authority",
            icon: Target,
            soon: true,
          },
          {
            href: "/tools/programmatic-seo",
            label: "Programmatic SEO",
            icon: Code2,
            soon: true,
          },
        ],
      },
      {
        id: "cro",
        label: "CRO",
        icon: MousePointer2,
        items: [
          {
            href: "/tools/ab-testing",
            label: "A/B Testing",
            icon: Beaker,
          },
          {
            href: "/tools/heatmaps",
            label: "Heatmaps",
            icon: Activity,
            soon: true,
          },
          {
            href: "/tools/funnel-optimization",
            label: "Funnel Optimization",
            icon: Target,
            soon: true,
          },
          {
            href: "/tools/cta-optimization",
            label: "CTA Optimization",
            icon: CircleArrowUp,
            soon: true,
          },
          {
            href: "/tools/backlinks",
            label: "Backlinks",
            icon: Link2,
            soon: true,
          },
        ],
      },
    ],
  },
  {
    id: "ecommerce",
    label: "E-commerce",
    subgroups: [
      {
        id: "shopify",
        label: "Shopify",
        icon: ShoppingCart,
        items: [
          {
            href: "/shopify",
            label: "Apps",
            icon: Store,
          },
          {
            href: "/shopify/listing-optimizer",
            label: "Listing Optimizer",
            icon: Rocket,
          },
        ],
      },
    ],
  },
  {
    id: "strategy",
    label: "Strategy & AI",
    subgroups: [
      {
        id: "competitive",
        label: "Research",
        icon: Target,
        items: [
          {
            href: "/tools/competitor-analysis",
            label: "Competitor Analysis",
            icon: Target,
          },
          {
            href: "/tools/buyer-persona",
            label: "Buyer Persona",
            icon: Network,
          },
          {
            href: "/tools/marketing-funnel",
            label: "Marketing Funnel",
            icon: BarChart3,
          },
        ],
      },
      {
        id: "strategy-tools",
        label: "Plan",
        icon: Network,
        items: [
          {
            href: "/strategies",
            label: "Strategies",
            icon: ListChecks,
            soon: true,
          },
          {
            href: "/campaigns",
            label: "Campaigns",
            icon: Megaphone,
            soon: true,
          },
          { href: "/content", label: "Content", icon: FileEdit, soon: true },
          { href: "/insights", label: "Insights", icon: BarChart3, soon: true },
        ],
      },
      {
        id: "ai",
        label: "AI Copilot",
        icon: Sparkles,
        items: [
          { href: "/ai/claude", label: "Claude", icon: Rocket, soon: true },
          { href: "/ai/image-studio", label: "Image Studio", icon: MagicWand },
        ],
      },
    ],
  },
];

const workspaceNav: NavLeaf[] = [
  { href: "/search", label: "Search", icon: Search, shortcut: "⌘K", soon: true },
  { href: "/settings", label: "Settings", icon: Settings, soon: true },
];

// ─── Active-route helpers ─────────────────────────────────────────────

/**
 * Pick the single most-specific nav href for the current pathname. Longest
 * matching prefix wins — so `/gm-prospecting/reports` highlights the
 * Reports leaf, not its `/gm-prospecting` parent.
 */
function findActiveHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (pathname === href || pathname.startsWith(href + "/")) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}

function collectAllHrefs(): string[] {
  const out: string[] = [];
  for (const l of pinnedNav) if (!l.soon) out.push(l.href);
  for (const c of categories)
    for (const s of c.subgroups)
      for (const i of s.items) if (!i.soon) out.push(i.href);
  for (const l of workspaceNav) if (!l.soon) out.push(l.href);
  return out;
}

function isSubgroupActive(activeHref: string | null, subgroup: NavSubgroup) {
  if (!activeHref) return false;
  return subgroup.items.some((item) => item.href === activeHref);
}

// ─── Public components ────────────────────────────────────────────────

/**
 * Desktop static sidebar — hidden below `md` (where Topbar surfaces a
 * hamburger that opens the same nav in a Sheet).
 */
export function Sidebar() {
  return (
    <aside
      data-print-hide
      className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card md:flex"
    >
      <SidebarContent />
    </aside>
  );
}

export function SidebarContent({
  onNavigate,
}: {
  onNavigate?: () => void;
} = {}) {
  const pathname = usePathname();
  const activeHref = useMemo(
    () => findActiveHref(pathname, collectAllHrefs()),
    [pathname],
  );

  return (
    <>
      {/* brand — matches topbar height (h-14) */}
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

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {/* Pinned items */}
        <ul className="space-y-0.5">
          {pinnedNav.map((leaf) => (
            <li key={leaf.href}>
              <LeafLink
                leaf={leaf}
                activeHref={activeHref}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>

        {/* Categories */}
        {categories.map((category) => (
          <CategoryBlock
            key={category.id}
            category={category}
            activeHref={activeHref}
            onNavigate={onNavigate}
          />
        ))}

        {/* Workspace footer items */}
        <div className="mt-6 px-3">
          <p className="text-label">workspace</p>
        </div>
        <ul className="mt-2 space-y-0.5">
          {workspaceNav.map((leaf) => (
            <li key={leaf.href}>
              <LeafLink
                leaf={leaf}
                activeHref={activeHref}
                onNavigate={onNavigate}
              />
            </li>
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

// ─── Internal components ──────────────────────────────────────────────

function CategoryBlock({
  category,
  activeHref,
  onNavigate,
}: {
  category: NavCategory;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="mt-6">
      <div className="px-3">
        <p className="text-label">{category.label}</p>
      </div>
      <ul className="mt-2 space-y-0.5">
        {category.subgroups.map((subgroup) => (
          <li key={subgroup.id}>
            <Subgroup
              subgroup={subgroup}
              activeHref={activeHref}
              onNavigate={onNavigate}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Subgroup({
  subgroup,
  activeHref,
  onNavigate,
}: {
  subgroup: NavSubgroup;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  const childActive = isSubgroupActive(activeHref, subgroup);
  // Open if a child route is currently active; otherwise let the user toggle.
  const [open, setOpen] = useState(childActive);
  // Keep `open` in sync when route changes externally.
  const effectiveOpen = useMemo(() => open || childActive, [open, childActive]);
  const Icon = subgroup.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={effectiveOpen}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
          childActive
            ? "text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        <Icon className="size-4" />
        <span className="flex-1 text-left">{subgroup.label}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            effectiveOpen ? "rotate-0" : "-rotate-90",
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {effectiveOpen ? (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <ul className="mt-0.5 ml-3 space-y-0.5 border-l border-border pl-3">
              {subgroup.items.map((leaf) => (
                <li key={leaf.href}>
                  <LeafLink
                    leaf={leaf}
                    activeHref={activeHref}
                    onNavigate={onNavigate}
                    nested
                  />
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function LeafLink({
  leaf,
  activeHref,
  onNavigate,
  nested = false,
}: {
  leaf: NavLeaf;
  activeHref: string | null;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const Icon = leaf.icon;
  const active = leaf.href === activeHref;
  const padding = nested ? "px-2.5 py-1.5" : "px-3 py-2";

  if (leaf.soon) {
    return (
      <span
        className={cn(
          "flex cursor-not-allowed items-center gap-2.5 rounded-md text-sm text-muted-foreground/55",
          padding,
        )}
        aria-disabled
      >
        {Icon ? <Icon className="size-3.5" /> : null}
        <span className="flex-1 truncate">{leaf.label}</span>
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground/45">
          soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={leaf.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md text-sm transition-colors",
        padding,
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      <span className="flex-1 truncate">{leaf.label}</span>
      {leaf.shortcut ? (
        <kbd className="rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
          {leaf.shortcut}
        </kbd>
      ) : null}
    </Link>
  );
}
