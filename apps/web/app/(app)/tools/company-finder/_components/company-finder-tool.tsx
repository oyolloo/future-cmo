"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { cn } from "@kit/ui/lib/utils";

import { findCompanyAction } from "../_lib/actions";

type Confidence = "high" | "medium" | "low";

type Result = {
  domain: string;
  brand: string;
  company: {
    name: string | null;
    description: string | null;
    logoUrl: string | null;
    address: string | null;
    phone: string | null;
  };
  emails: Array<{ email: string; confidence: Confidence }>;
  socials: Array<{
    platform: string;
    url: string;
    handle: string | null;
    matchPct: number;
    source: "site" | "schema-sameAs";
  }>;
  people: Array<{
    name: string;
    designation: string | null;
    confidence: Confidence;
  }>;
  pagesScanned: string[];
  durationMs: number;
};

export function CompanyFinderTool() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onScan = () => {
    if (!url.trim()) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await findCompanyAction(url.trim());
      if (res.ok) setResult(res.data);
      else setError(res.error.message);
    });
  };

  return (
    <div className="space-y-6">
      {/* Input */}
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-label">Domain or URL</p>
        <div className="mt-3 flex gap-2">
          <Input
            type="url"
            placeholder="tablepilot.app"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onScan()}
            disabled={isPending}
          />
          <Button onClick={onScan} disabled={isPending || !url.trim()}>
            {isPending ? "Scanning…" : "Find company"}
          </Button>
        </div>
        <p className="text-comment mt-2">
          {"// scrapes site + JSON-LD + AI-extracts people (free models only)"}
        </p>
      </div>

      {/* Loading */}
      {isPending ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">
            Scraping pages, parsing schema, finding emails + socials, AI-extracting people…
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
          {/* Company header card */}
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="flex flex-wrap items-start gap-4">
              {result.company.logoUrl ? (
                <img
                  src={result.company.logoUrl}
                  alt={result.company.name ?? ""}
                  className="size-16 shrink-0 rounded-lg border border-border object-contain bg-white p-1"
                />
              ) : (
                <span className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-lg font-semibold text-muted-foreground">
                  {(result.company.name ?? result.brand).charAt(0).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-label">Company</p>
                <h2 className="mt-1 text-xl font-semibold text-foreground">
                  {result.company.name ?? "(name not detected)"}
                </h2>
                <p className="mt-1 font-mono text-[0.6875rem] text-primary">
                  {result.domain}
                </p>
                {result.company.description ? (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                    {result.company.description}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Quick facts grid */}
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <FactRow label="Address" value={result.company.address} />
              <FactRow label="Phone" value={result.company.phone} mono />
            </div>
          </div>

          {/* People */}
          {result.people.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-label">
                People · {result.people.length}{" "}
                <span className="text-comment ml-2">{"// extracted by AI"}</span>
              </p>
              <ul className="mt-3 divide-y divide-border">
                {result.people.map((p, i) => (
                  <li key={`${p.name}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {p.name}
                      </span>
                      {p.designation ? (
                        <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-muted-foreground">
                          {p.designation}
                        </span>
                      ) : null}
                      <ConfidencePill confidence={p.confidence} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Social media with match % */}
          {result.socials.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-label">
                Social profiles · {result.socials.length}
              </p>
              <p className="text-comment mt-1">
                {`// brand: "${result.brand}" — match % compares handle vs brand string`}
              </p>
              <ul className="mt-3 space-y-2">
                {result.socials.map((s) => (
                  <li
                    key={s.url}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                      {s.platform}
                    </span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {s.url.replace(/^https?:\/\//, "")}
                    </a>
                    {s.handle ? (
                      <span className="font-mono text-[0.625rem] text-muted-foreground">
                        @{s.handle}
                      </span>
                    ) : null}
                    {s.source === "schema-sameAs" ? (
                      <span className="rounded border border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] px-1.5 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider text-[oklch(0.80_0.14_160)]">
                        verified · schema
                      </span>
                    ) : null}
                    <span className="ml-auto flex items-center gap-2">
                      <span
                        className={cn(
                          "font-mono text-sm font-semibold",
                          matchColor(s.matchPct),
                        )}
                      >
                        {s.matchPct}%
                      </span>
                      <span className="text-[0.625rem] text-muted-foreground">
                        match
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Emails */}
          {result.emails.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <p className="text-label">Emails · {result.emails.length}</p>
              <ul className="mt-3 divide-y divide-border">
                {result.emails.map((e) => (
                  <li
                    key={e.email}
                    className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                  >
                    <a
                      href={`mailto:${e.email}`}
                      className="font-mono text-sm text-foreground hover:text-primary hover:underline"
                    >
                      {e.email}
                    </a>
                    <ConfidencePill confidence={e.confidence} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Footer */}
          <details className="rounded-lg border border-border bg-card p-5">
            <summary className="cursor-pointer text-label">
              Pages scanned · {result.pagesScanned.length} ·{" "}
              <span className="font-mono text-[0.625rem] text-muted-foreground normal-case tracking-normal">
                {(result.durationMs / 1000).toFixed(1)}s
              </span>
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

function FactRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <p className="text-[0.625rem] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm",
          mono && "font-mono text-xs",
          value ? "text-foreground" : "text-muted-foreground/50 italic",
        )}
      >
        {value ?? "not detected"}
      </p>
    </div>
  );
}

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

function matchColor(pct: number): string {
  if (pct >= 80) return "text-[oklch(0.80_0.14_160)]";
  if (pct >= 50) return "text-[oklch(0.85_0.14_90)]";
  return "text-destructive";
}
