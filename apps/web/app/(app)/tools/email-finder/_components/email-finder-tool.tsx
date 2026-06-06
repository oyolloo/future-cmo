"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { cn } from "@kit/ui/lib/utils";

import { findEmailsAction } from "../_lib/actions";

type Confidence = "high" | "medium" | "low";

type Result = {
  domain: string;
  pagesScanned: string[];
  emails: Array<{ email: string; confidence: Confidence; sources: string[] }>;
  durationMs: number;
};

export function EmailFinderTool() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<Confidence | "all" | null>(null);
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

  const copyByConfidence = (which: Confidence | "all") => {
    if (!result) return;
    const list = which === "all"
      ? result.emails
      : result.emails.filter((e) => e.confidence === which);
    navigator.clipboard.writeText(list.map((e) => e.email).join(", "));
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  const counts = result
    ? {
        high: result.emails.filter((e) => e.confidence === "high").length,
        medium: result.emails.filter((e) => e.confidence === "medium").length,
        low: result.emails.filter((e) => e.confidence === "low").length,
      }
    : null;

  return (
    <div className="space-y-6">
      {/* URL input */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-label">Domain or URL</p>
        <div className="mt-3 flex gap-2">
          <Input
            type="url"
            placeholder="acmestore.com"
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
          {"// 3 signals: site scrape (homepage + /contact, /about, /team, /support, /imprint) + DuckDuckGo + common patterns"}
        </p>
      </div>

      {/* Loading */}
      {isPending ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">
            Crawling site, searching DuckDuckGo, ranking by confidence…
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
      {result && counts ? (
        <>
          {/* Stats — confidence breakdown */}
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard
              label="Total"
              value={result.emails.length}
              tone={result.emails.length > 0 ? "ok" : "warn"}
            />
            <StatCard
              label="High confidence"
              value={counts.high}
              tone="ok"
              hint="// mailto + same-domain"
            />
            <StatCard
              label="Medium"
              value={counts.medium}
              tone={counts.medium > 0 ? "neutral" : "neutral"}
              hint="// partners / search"
            />
            <StatCard
              label="Low"
              value={counts.low}
              tone="neutral"
              hint="// guessed patterns"
            />
          </div>

          {/* Email list */}
          {result.emails.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-label">
                  {result.domain} · {result.emails.length} emails
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {counts.high > 0 ? (
                    <button
                      type="button"
                      onClick={() => copyByConfidence("high")}
                      className="font-mono text-[0.625rem] uppercase tracking-wider text-[oklch(0.80_0.14_160)] hover:underline"
                    >
                      {copied === "high" ? "✓ copied" : `copy high (${counts.high})`}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => copyByConfidence("all")}
                    className="font-mono text-[0.625rem] uppercase tracking-wider text-primary hover:underline"
                  >
                    {copied === "all" ? "✓ copied" : "copy all"}
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
                  <li key={row.email} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ConfidencePill confidence={row.confidence} />
                      <a
                        href={`mailto:${row.email}`}
                        className="font-mono text-sm text-foreground hover:text-primary hover:underline"
                      >
                        {row.email}
                      </a>
                      {row.email.endsWith(`@${result.domain}`) ? (
                        <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-muted-foreground">
                          same domain
                        </span>
                      ) : (
                        <span className="rounded border border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/10%)] px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[oklch(0.85_0.14_90)]">
                          external
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[0.625rem] text-muted-foreground">
                        {row.sources.length}{" "}
                        {row.sources.length === 1 ? "source" : "sources"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                      {row.sources.map((src) => (
                        <span
                          key={src}
                          className="truncate font-mono text-[0.6rem] text-muted-foreground/70"
                          title={src}
                          style={{ maxWidth: "100%" }}
                        >
                          {src.replace(/^https?:\/\//, "")}
                        </span>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No emails found on the scanned pages or via search.
              </p>
              <p className="text-comment mt-2">
                {"// site may use a contact form, image-based emails, or block scrapers — try big brands manually"}
              </p>
            </div>
          )}

          {/* Scanned sources */}
          <details className="rounded-lg border border-border bg-card p-5">
            <summary className="cursor-pointer text-label">
              Sources checked · {result.pagesScanned.length} ·{" "}
              <span className="font-mono text-[0.625rem] text-muted-foreground normal-case tracking-normal">
                {(result.durationMs / 1000).toFixed(1)}s
              </span>
            </summary>
            <ul className="mt-3 space-y-1">
              {result.pagesScanned.map((p) => (
                <li key={p}>
                  {p.startsWith("http") ? (
                    <a
                      href={p}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[0.6875rem] text-muted-foreground hover:text-primary hover:underline"
                    >
                      {p}
                    </a>
                  ) : (
                    <span className="font-mono text-[0.6875rem] text-muted-foreground">
                      {p}
                    </span>
                  )}
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

function ConfidencePill({ confidence }: { confidence: Confidence }) {
  const styles = {
    high: "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
    medium: "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/10%)] text-[oklch(0.85_0.14_90)]",
    low: "border-border bg-muted/40 text-muted-foreground",
  }[confidence];

  return (
    <span
      className={cn(
        "shrink-0 rounded border px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider",
        styles,
      )}
    >
      {confidence}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number | string;
  tone: "ok" | "neutral" | "warn";
  hint?: string;
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
      {hint ? <p className="text-comment mt-1">{hint}</p> : null}
    </div>
  );
}
