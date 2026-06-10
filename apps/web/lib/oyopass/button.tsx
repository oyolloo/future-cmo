"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

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

// ─── Types ───────────────────────────────────────────────────────────

interface OyoPassButtonProps {
  /** Path to the initiate route (default: /api/auth/oyopass) */
  initiatePath?: string;
  /** Where to redirect after successful login (default: /dashboard) */
  redirectTo?: string;
  /** Button text (default: Login with OyoPass) */
  label?: string;
  /** Loading text (default: Connecting...) */
  loadingLabel?: string;
  /** Popup width (default: 500) */
  popupWidth?: number;
  /** Popup height (default: 600) */
  popupHeight?: number;
  /** Additional CSS classes */
  className?: string;
  /** Called on error */
  onError?: (error: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────

export function OyoPassButton({
  initiatePath = "/api/auth/oyopass",
  redirectTo = "/dashboard",
  label = "Login with OyoPass",
  loadingLabel = "Connecting...",
  popupWidth = 500,
  popupHeight = 600,
  className,
  onError,
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

  return (
    <button
      type="button"
      onClick={openPopup}
      disabled={loading}
      className={
        className ??
        "flex w-full items-center justify-center gap-2.5 rounded-md border border-[#333] bg-transparent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/[0.04] disabled:opacity-50"
      }
    >
      <OyoPassLogo />
      {loading ? loadingLabel : label}
    </button>
  );
}
