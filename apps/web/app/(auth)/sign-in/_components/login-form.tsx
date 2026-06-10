"use client";

import { useState } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";

function OyoPassIcon({ className }: { className?: string }) {
  return (
    <svg width={20} height={20} viewBox="0 0 32 32" fill="none" className={className}>
      <rect width="32" height="32" rx="7" fill="url(#oyopass-grad)" />
      <circle cx="16" cy="16" r="6" stroke="white" strokeWidth="2.2" />
      <circle cx="21" cy="11" r="2.2" fill="white" />
      <defs>
        <linearGradient id="oyopass-grad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#3d9bff" />
          <stop offset="1" stopColor="#007aff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        setErrorMsg(data.error?.message ?? "Something went wrong");
        setStatus("error");
        return;
      }

      setStatus("sent");
    } catch {
      setErrorMsg("Network error. Try again.");
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border-2 border-[oklch(0.72_0.14_160/40%)] bg-[oklch(0.72_0.14_160/10%)]">
          <span className="text-2xl">✉</span>
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Check your email
        </h2>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to{" "}
          <span className="font-medium text-foreground">{email}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          The link expires in 15 minutes. Check spam if you don't see it.
        </p>
        <button
          type="button"
          onClick={() => {
            setStatus("idle");
            setEmail("");
          }}
          className="mt-2 font-mono text-xs text-primary hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* OyoPass SSO button */}
      <a
        href="/api/auth/oyopass"
        className="flex w-full items-center justify-center gap-2.5 rounded-md border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <OyoPassIcon />
        Login with OyoPass
      </a>

      {/* Divider */}
      <div className="relative flex items-center">
        <div className="flex-1 border-t border-border" />
        <span className="px-3 text-xs text-muted-foreground">or</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Magic link form */}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Email address
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={status === "sending"}
            required
          />
        </div>

        {status === "error" && errorMsg ? (
          <p className="text-sm text-destructive" role="alert">
            {errorMsg}
          </p>
        ) : null}

        <Button
          type="submit"
          className="w-full"
          disabled={status === "sending" || !email.trim()}
        >
          {status === "sending" ? "Sending…" : "Send magic link"}
        </Button>

        <p className="text-center font-mono text-[0.6875rem] text-muted-foreground">
          {"// no password needed — we'll email you a sign-in link"}
        </p>
      </form>
    </div>
  );
}
