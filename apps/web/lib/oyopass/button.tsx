"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";

// ─── Inline spinner (no icon library dependency) ─────────────────────

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className ?? "size-4"}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

// ─── OyoPass Logo ────────────────────────────────────────────────────

function OyoPassLogo({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="url(#oyopass-btn-g)" />
      <circle cx="16" cy="16" r="6" stroke="white" strokeWidth="2.2" />
      <circle cx="21" cy="11" r="2.2" fill="white" />
      <defs>
        <linearGradient id="oyopass-btn-g" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#3d9bff" />
          <stop offset="1" stopColor="#007aff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export { OyoPassLogo };

// ─── Types ───────────────────────────────────────────────────────────

export interface OyoPassButtonProps {
  /** Path to the initiate route (default: /api/auth/oyopass) */
  initiatePath?: string;
  /** Where to redirect after successful login (default: /dashboard) */
  redirectTo?: string;
  /** Button label (default: Sign in with OyoPass) */
  label?: string;
  /** Loading label (default: Connecting...) */
  loadingLabel?: string;
  /** Popup width (default: 500) */
  popupWidth?: number;
  /** Popup height (default: 600) */
  popupHeight?: number;
  /** Additional CSS classes */
  className?: string;
  /** Called on error */
  onError?: (error: string) => void;
  /**
   * Custom render — lets the consuming app control the button look.
   * Receives { loading, onClick, label, logo } and returns JSX.
   * If omitted, renders a default styled <button>.
   */
  render?: (props: {
    loading: boolean;
    onClick: () => void;
    label: string;
    logo: ReactNode;
  }) => ReactNode;
}

// ─── Component ───────────────────────────────────────────────────────

export function OyoPassButton({
  initiatePath = "/api/auth/oyopass",
  redirectTo = "/dashboard",
  label = "Sign in with OyoPass",
  loadingLabel = "Connecting...",
  popupWidth = 500,
  popupHeight = 600,
  className,
  onError,
  render,
}: OyoPassButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (e.data?.type !== "oyopass_callback") return;
      setLoading(false);
      if (e.data.ok) {
        router.push(redirectTo);
        router.refresh();
      } else {
        onError?.(e.data.error ?? "OyoPass sign-in failed");
      }
    },
    [router, redirectTo, onError],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const openPopup = () => {
    setLoading(true);

    const left = window.screenX + (window.innerWidth - popupWidth) / 2;
    const top = window.screenY + (window.innerHeight - popupHeight) / 2;

    const popup = window.open(
      initiatePath,
      "oyopass_sso",
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},popup=yes,toolbar=no,menubar=no`,
    );

    if (!popup) {
      setLoading(false);
      onError?.("Popup was blocked. Please allow popups for this site.");
      return;
    }

    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        setLoading(false);
      }
    }, 500);
  };

  const logo = loading ? <Spinner /> : <OyoPassLogo />;
  const currentLabel = loading ? loadingLabel : label;

  // Custom render
  if (render) {
    return <>{render({ loading, onClick: openPopup, label: currentLabel, logo })}</>;
  }

  // Default render
  return (
    <button
      type="button"
      onClick={openPopup}
      disabled={loading}
      className={
        className ??
        "inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
      }
    >
      {logo}
      {currentLabel}
    </button>
  );
}
