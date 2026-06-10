"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { Label } from "@kit/ui/label";
import { Checkbox } from "@kit/ui/checkbox";
import { Separator } from "@kit/ui/separator";

import { loginAction } from "../_lib/actions";

function OyoPassIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="7" fill="url(#op-g)" />
      <circle cx="16" cy="16" r="6" stroke="white" strokeWidth="2.2" />
      <circle cx="21" cy="11" r="2.2" fill="white" />
      <defs>
        <linearGradient id="op-g" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#3d9bff" />
          <stop offset="1" stopColor="#007aff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);

  // Listen for popup callback message
  const handleMessage = useCallback(
    (e: MessageEvent) => {
      if (e.data?.type !== "oyopass_callback") return;
      setSsoLoading(false);
      if (e.data.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(e.data.error ?? "OyoPass sign-in failed");
      }
    },
    [router],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const openOyoPassPopup = () => {
    setSsoLoading(true);
    setError("");

    const w = 500;
    const h = 600;
    const left = window.screenX + (window.innerWidth - w) / 2;
    const top = window.screenY + (window.innerHeight - h) / 2;

    const popup = window.open(
      "/api/auth/oyopass",
      "oyopass_sso",
      `width=${w},height=${h},left=${left},top=${top},popup=yes,toolbar=no,menubar=no`,
    );

    // If popup was blocked
    if (!popup) {
      setSsoLoading(false);
      setError("Popup was blocked. Please allow popups for this site.");
      return;
    }

    // Poll for popup close (user closed manually without completing)
    const timer = setInterval(() => {
      if (popup.closed) {
        clearInterval(timer);
        setSsoLoading(false);
      }
    }, 500);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const result = await loginAction(formData);

    if (result.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError(result.error.message);
      setPending(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Email/Username + Password form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="identifier">Email or username</Label>
          <Input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="Your password"
              className="pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOffIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox name="rememberMe" />
            <span className="text-muted-foreground">Remember me</span>
          </label>
          <a
            href="/forgot-password"
            className="text-sm text-primary hover:underline transition-colors"
          >
            Forgot password?
          </a>
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative flex items-center justify-center">
        <Separator className="flex-1" />
        <span className="px-3 text-xs text-muted-foreground bg-card absolute">
          or
        </span>
      </div>

      {/* OyoPass SSO — opens popup */}
      <button
        type="button"
        onClick={openOyoPassPopup}
        disabled={ssoLoading}
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
      >
        <OyoPassIcon />
        {ssoLoading ? "Connecting..." : "Login with OyoPass"}
      </button>

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <a href="/sign-up" className="text-primary hover:underline transition-colors">
          Create an account
        </a>
      </p>
    </div>
  );
}
