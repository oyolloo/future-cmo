"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { cn } from "@kit/ui/lib/utils";

import { findEmailsAction } from "../_lib/actions";

type Result = {
  startUrl: string;
  pagesScanned: string[];
  emails: Array<{ email: string; sources: string[] }>;
  durationMs: number;
};

export function EmailFinderTool() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onScan = () => {
    if (!url.trim()) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await findEmailsAction(url.trim());
      if (res.ok) {
        setResult(res.data);
      } else {
        setError(res.error.message);
      }
    });
  };

  const copyAll = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.emails.map((e) => e.email).join(", "));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      {/* URL input */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-label">Website URL</p>
        <div className="mt-3 flex gap-2">
          <Input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onScan()}
            disabled={isPending}
          />
          <Button onClick={onScan} disabled={isPending || !url.trim()}>
            {isPending ? "Scanning…" : "Find emails"}
          </Button>
        </div>
        <p className="text-comment mt-2">
          {"// scans homepage + /contact, /about, /team, /support, /imprint and similar"}
        </p>
      </div>

      {/* Loading */}
      {isPending ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">
            Crawling pages and extracting emails…
          </p>
        </div>
      ) : null}

      {/* Error */}
      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {/* Results */}
      {result ? (
        <>
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Emails found"
              value={result.emails.length}
              tone={result.emails.length > 0 ? "ok" : "warn"}
            />
            <StatCard
              label="Pages scanned"
              value={result.pagesScanned.length}
              tone="neutral"
            />
            <StatCard
              label="Duration"
              value={`${(result.durationMs / 1000).toFixed(1)}s`}
              tone="neutral"
            />
          </div>

          {/* Email list */}
          {result.emails.length > 0 ? (
            <div className="rounded-lg border border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/5%)] p-5">
              <div className="flex items-center justify-between">
                <p className="text-label text-[oklch(0.80_0.14_160)]">
                  Emails · {result.emails.length}
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={copyAll}
                    className="font-mono text-[0.625rem] uppercase tracking-wider text-primary hover:underline"
                  >
                    {copied ? "✓ copied" : "copy all"}
                  </button>
                  <Link
                    href={`/tools/email-validator`}
                    className="font-mono text-[0.625rem] uppercase tracking-wider text-primary hover:underline"
                  >
                    validate →
                  </Link>
                </div>
              </div>

              <ul className="mt-4 divide-y divide-border">
                {result.emails.map((row) => (
                  <li key={row.email} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <a
                          href={`mailto:${row.email}`}
                          className="font-mono text-sm text-foreground hover:text-primary hover:underline"
                        >
                          {row.email}
                        </a>
                        <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
                          {row.sources.length}{" "}
                          {row.sources.length === 1 ? "source" : "sources"}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {row.sources.map((src) => (
                        <a
                          key={src}
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate font-mono text-[0.625rem] text-muted-foreground hover:text-primary hover:underline"
                          style={{ maxWidth: "100%" }}
                        >
                          {src.replace(/^https?:\/\//, "")}
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No emails found on the scanned pages.
              </p>
              <p className="text-comment mt-2">
                {"// the site may use a contact form, image-based emails, or JS-rendered content"}
              </p>
            </div>
          )}

          {/* Scanned pages */}
          <details className="rounded-lg border border-border bg-card p-5">
            <summary className="cursor-pointer text-label">
              Pages scanned · {result.pagesScanned.length}
            </summary>
            <ul className="mt-3 space-y-1">
              {result.pagesScanned.map((p) => (
                <li key={p}>
                  <a
                    href={p}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[0.6875rem] text-muted-foreground hover:text-primary hover:underline"
                  >
                    {p}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </>
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
  value: number | string;
  tone: "ok" | "neutral" | "warn";
}) {
  const color = {
    ok: "text-[oklch(0.80_0.14_160)]",
    neutral: "text-foreground",
    warn: "text-[oklch(0.85_0.14_90)]",
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
