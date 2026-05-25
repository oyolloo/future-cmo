"use client"

/**
 * Central icon registry for future-cmo.
 *
 * Why this file exists:
 *   1. Swapping a glyph (e.g. changing the dashboard icon site-wide) is a
 *      one-line change.
 *   2. Single icon-library surface for the whole monorepo — apps/web,
 *      @kit/ui primitives, and any future package use the same set.
 *   3. Consumers get clean named React components compatible with the
 *      former Lucide API (just `className` / `size`).
 *
 * Usage:
 *   import { DashboardIcon, MapPinIcon } from "@kit/ui/icons"
 *   <DashboardIcon className="size-4" />
 */

import {
  Activity03Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  BarChartIcon as BarChartIconRaw,
  ArrowUpRight01Icon,
  BookOpen01Icon,
  Briefcase01Icon,
  Building01Icon,
  Call02Icon,
  Cancel01Icon,
  CheckmarkCircleIcon,
  CircleArrowUp01Icon,
  ClipboardIcon as ClipboardIconRaw,
  Clock01Icon,
  CodeIcon as CodeIconRaw,
  CursorPointer01Icon,
  DashboardCircleIcon,
  DashboardSpeedIcon,
  Edit01Icon,
  File01Icon,
  GlobeIcon as GlobeIconRaw,
  Home01Icon,
  InformationCircleIcon,
  Link01Icon,
  Loading01Icon,
  Logout01Icon,
  MagicWand01Icon,
  Megaphone01Icon,
  Menu01Icon,
  MobileNavigator01Icon,
  MoreHorizontalIcon as MoreHorizontalIconRaw,
  PlusSignIcon,
  Rocket02Icon,
  Search01Icon,
  Settings01Icon,
  Share01Icon,
  ShoppingCart01Icon,
  SparklesIcon as SparklesIconRaw,
  StarIcon as StarIconRaw,
  Store01Icon,
  StoreLocation01Icon,
  TaskDone01Icon,
  Target01Icon,
  TestTube01Icon,
  Tick01Icon,
  Triangle01Icon,
} from "@hugeicons/core-free-icons"
import {
  HugeiconsIcon,
  type IconSvgElement,
} from "@hugeicons/react"
import type { ComponentProps, SVGProps } from "react"

type HugeProps = ComponentProps<typeof HugeiconsIcon>

export type IconComponentProps = SVGProps<SVGSVGElement> & {
  size?: HugeProps["size"]
  strokeWidth?: HugeProps["strokeWidth"]
}

/** Create a drop-in React component from a HugeIcons data object. */
function createIcon(icon: IconSvgElement) {
  function Icon(props: IconComponentProps) {
    return (
      <HugeiconsIcon
        icon={icon}
        {...(props as Omit<HugeProps, "icon">)}
      />
    )
  }
  return Icon
}

/** Type-only alias for components that take an icon-as-prop. */
export type IconComponent = ReturnType<typeof createIcon>

// ─── Navigation / structure ───────────────────────────────────────────
export const DashboardIcon = createIcon(DashboardCircleIcon)
export const HomeIcon = createIcon(Home01Icon)
export const LibraryIcon = createIcon(BookOpen01Icon)
export const SearchIcon = createIcon(Search01Icon)
export const SettingsIcon = createIcon(Settings01Icon)
export const MenuIcon = createIcon(Menu01Icon)
export const ChevronDownIcon = createIcon(ArrowDown01Icon)
export const ChevronUpIcon = createIcon(ArrowUp01Icon)
export const ChevronLeftIcon = createIcon(ArrowLeft01Icon)
export const ChevronRightIcon = createIcon(ArrowRight01Icon)
export const CloseIcon = createIcon(Cancel01Icon)
export const PlusIcon = createIcon(PlusSignIcon)
export const CheckIcon = createIcon(Tick01Icon)
export const MoreHorizontalIcon = createIcon(MoreHorizontalIconRaw)

// ─── Lead Generation ──────────────────────────────────────────────────
export const MapPinIcon = createIcon(StoreLocation01Icon)
export const StoreIcon = createIcon(Store01Icon)
export const ShoppingCartIcon = createIcon(ShoppingCart01Icon)
export const FileTextIcon = createIcon(File01Icon)
export const ClipboardIcon = createIcon(ClipboardIconRaw)

// ─── Web & Digital ────────────────────────────────────────────────────
export const GlobeIcon = createIcon(GlobeIconRaw)
export const GaugeIcon = createIcon(DashboardSpeedIcon)
export const SmartphoneIcon = createIcon(MobileNavigator01Icon)
export const CodeIcon = createIcon(CodeIconRaw)

// ─── CRO ──────────────────────────────────────────────────────────────
export const MousePointerIcon = createIcon(CursorPointer01Icon)
export const BeakerIcon = createIcon(TestTube01Icon)
export const ActivityIcon = createIcon(Activity03Icon)
export const TargetIcon = createIcon(Target01Icon)
export const CircleArrowUpIcon = createIcon(CircleArrowUp01Icon)
export const LinkIcon = createIcon(Link01Icon)

// ─── Strategy & AI ────────────────────────────────────────────────────
export const NetworkIcon = createIcon(Briefcase01Icon)
export const ListChecksIcon = createIcon(TaskDone01Icon)
export const MegaphoneIcon = createIcon(Megaphone01Icon)
export const FileEditIcon = createIcon(Edit01Icon)
export const BarChartIcon = createIcon(BarChartIconRaw)
export const SparklesIcon = createIcon(SparklesIconRaw)
export const MagicWandIcon = createIcon(MagicWand01Icon)
export const RocketIcon = createIcon(Rocket02Icon)

// ─── User actions ─────────────────────────────────────────────────────
export const LogoutIcon = createIcon(Logout01Icon)
export const ShareIcon = createIcon(Share01Icon)

// ─── Status / feedback ────────────────────────────────────────────────
export const SuccessIcon = createIcon(CheckmarkCircleIcon)
export const ErrorIcon = createIcon(AlertCircleIcon)
export const WarningIcon = createIcon(Triangle01Icon)
export const InfoIcon = createIcon(InformationCircleIcon)
export const LoadingIcon = createIcon(Loading01Icon)

// ─── Data atoms (tables, cards) ───────────────────────────────────────
export const StarIcon = createIcon(StarIconRaw)
export const BuildingIcon = createIcon(Building01Icon)
export const ClockIcon = createIcon(Clock01Icon)
export const PhoneIcon = createIcon(Call02Icon)
export const ExternalLinkIcon = createIcon(ArrowUpRight01Icon)
