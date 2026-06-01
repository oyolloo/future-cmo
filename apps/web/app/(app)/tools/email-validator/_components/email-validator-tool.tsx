"use client";

import { useMemo, useState } from "react";

import { Button } from "@kit/ui/button";
import { cn } from "@kit/ui/lib/utils";
import {
  MultiEmailInput,
  extractEmails,
  isValidEmail,
} from "@kit/ui/multi-email-input";

export function EmailValidatorTool() {
  const [pasted, setPasted] = useState("");
  const [emails, setEmails] = useState<string[]>([]);
  const [copied, setCopied] = useState<"valid" | "all" | null>(null);

  const stats = useMemo(() => {
    const valid: string[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();

    for (const raw of emails) {
      const e = raw.trim().toLowerCase();
      if (seen.has(e)) continue;
      seen.add(e);
      if (isValidEmail(e)) valid.push(e);
      else invalid.push(e);
    }
    return { valid, invalid, total: valid.length + invalid.length };
  }, [emails]);

  const extractFromPasted = () => {
    const found = extractEmails(pasted);
    if (found.length === 0) return;
    const merged = [...emails];
    for (const e of found) if (!merged.includes(e)) merged.push(e);
    setEmails(merged);
    setPasted("");
  };

  const copy = (which: "valid" | "all") => {
    const list = which === "valid" ? stats.valid : [...stats.valid, ...stats.invalid];
    navigator.clipboard.writeText(list.join(", "));
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  const clear = () => {
    setEmails([]);
    setPasted("");
  };

  return (
    <div className="space-y-6">
      {/* Bulk paste */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-label">Paste text · auto-extract</p>
          <p className="text-comment">
            {"// works with names, brackets, commas, semicolons, newlines"}
          </p>
        </div>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          onBlur={extractFromPasted}
          rows={6}
          placeholder={`Paste anything:\n\nJohn Doe <john@example.com>, jane@y.io\nbob.smith+work@company.com\n"Sales" <sales@biz.net>; support@x.com`}
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={extractFromPasted} disabled={!pasted.trim()}>
            Extract emails
          </Button>
          <p className="text-comment">
            {"// or blur the textarea — extraction is automatic"}
          </p>
        </div>
      </div>

      {/* Input + pills */}
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <p className="text-label">Recipients · {stats.total}</p>
          {emails.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground hover:text-destructive"
            >
              clear all
            </button>
          ) : null}
        </div>
        <div className="mt-3">
          <MultiEmailInput
            value={emails}
            onChange={setEmails}
            placeholder="name@example.com — type, paste, or press Enter"
          />
        </div>
        <p className="text-comment mt-2">
          {"// green = valid · red = invalid · click ✕ to remove · backspace to remove last"}
        </p>
      </div>

      {/* Stats */}
      {stats.total > 0 ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Total unique"
            value={stats.total}
            tone="neutral"
          />
          <StatCard
            label="Valid"
            value={stats.valid.length}
            tone="ok"
          />
          <StatCard
            label="Invalid"
            value={stats.invalid.length}
            tone={stats.invalid.length > 0 ? "warn" : "neutral"}
          />
        </div>
      ) : null}

      {/* Valid list */}
      {stats.valid.length > 0 ? (
        <ResultsCard
          label="Valid emails"
          count={stats.valid.length}
          accent="ok"
          emails={stats.valid}
          copied={copied === "valid"}
          onCopy={() => copy("valid")}
        />
      ) : null}

      {/* Invalid list */}
      {stats.invalid.length > 0 ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-label text-destructive">
            Invalid · {stats.invalid.length}
          </p>
          <p className="text-comment mt-2">
            {"// likely typos, missing TLD, or stray characters"}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {stats.invalid.map((e, i) => (
              <span
                key={`${e}-${i}`}
                className="rounded border border-destructive/30 bg-destructive/10 px-2 py-0.5 font-mono text-[0.6875rem] text-destructive"
              >
                {e}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Empty state */}
      {stats.total === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-background p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Paste a list above or type emails to start validating.
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "neutral" | "warn";
}) {
  const color = {
    ok: "text-[oklch(0.80_0.14_160)]",
    neutral: "text-foreground",
    warn: "text-destructive",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-label">{label}</p>
      <p className={cn("mt-1.5 font-mono text-2xl font-semibold", color)}>
        {value}
      </p>
    </div>
  );
}

function ResultsCard({
  label,
  count,
  accent,
  emails,
  copied,
  onCopy,
}: {
  label: string;
  count: number;
  accent: "ok";
  emails: string[];
  copied: boolean;
  onCopy: () => void;
}) {
  const styles = {
    ok: "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/5%)] text-[oklch(0.80_0.14_160)]",
  }[accent];

  return (
    <div className={cn("rounded-lg border p-5", styles)}>
      <div className="flex items-center justify-between">
        <p className="text-label" style={{ color: "inherit" }}>
          {label} · {count}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="font-mono text-[0.625rem] uppercase tracking-wider text-primary hover:underline"
        >
          {copied ? "✓ copied" : "copy comma-separated"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {emails.map((e, i) => (
          <span
            key={`${e}-${i}`}
            className="rounded border border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] px-2 py-0.5 font-mono text-[0.6875rem]"
          >
            {e}
          </span>
        ))}
      </div>
    </div>
  );
}
