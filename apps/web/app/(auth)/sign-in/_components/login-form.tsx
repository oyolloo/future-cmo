"use client";

import { useState } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";

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
  );
}
