"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { Input } from "@kit/ui/input";
import { cn } from "@kit/ui/lib/utils";

import {
  findSocialLinksAction,
  type SocialLinksData,
} from "../_lib/actions";

const PLATFORM_COLORS: Record<string, string> = {
  facebook: "border-[#1877F2]/30 bg-[#1877F2]/10 text-[#1877F2]",
  instagram: "border-[#E4405F]/30 bg-[#E4405F]/10 text-[#E4405F]",
  twitter: "border-foreground/30 bg-foreground/10 text-foreground",
  linkedin: "border-[#0A66C2]/30 bg-[#0A66C2]/10 text-[#0A66C2]",
  youtube: "border-[#FF0000]/30 bg-[#FF0000]/10 text-[#FF0000]",
  tiktok: "border-foreground/30 bg-foreground/10 text-foreground",
  pinterest: "border-[#BD081C]/30 bg-[#BD081C]/10 text-[#BD081C]",
  github: "border-foreground/30 bg-foreground/10 text-foreground",
  threads: "border-foreground/30 bg-foreground/10 text-foreground",
  snapchat: "border-[#FFFC00]/30 bg-[#FFFC00]/10 text-[#FFFC00]",
  discord: "border-[#5865F2]/30 bg-[#5865F2]/10 text-[#5865F2]",
};

const SOURCE_LABELS: Record<string, string> = {
  scrape: "website",
  google: "google",
  schema: "schema.org",
};

export function SocialLinksTool() {
  const [url, setUrl] = useState("");
  const [deep, setDeep] = useState(false);
  const [result, setResult] = useState<SocialLinksData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const onScan = () => {
    if (!url.trim()) return;
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await findSocialLinksAction(url.trim(), { deep });
      if (res.ok) {
        setResult(res.data);
      } else {
        setError(res.error.message);
      }
    });
  };

  const copyUrl = (platform: string, linkUrl: string) => {
    navigator.clipboard.writeText(linkUrl);
    setCopied(platform);
    setTimeout(() => setCopied(null), 1500);
  };

  const copyAll = () => {
    if (!result) return;
    const text = result.links.map((l) => `${l.platform}: ${l.url}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied("__all__");
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-5">
        <p className="text-label">Website URL</p>
        <div className="mt-3 flex gap-2">
          <Input
            type="url"
            placeholder="example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onScan()}
            disabled={isPending}
          />
          <Button onClick={onScan} disabled={isPending || !url.trim()}>
            {isPending ? "Scanning..." : "Find links"}
          </Button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDeep(false)}
            className={cn(
              "rounded-md border px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors",
              !deep
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Quick scan
          </button>
          <button
            type="button"
            onClick={() => setDeep(true)}
            className={cn(
              "rounded-md border px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider transition-colors",
              deep
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            Deep search
          </button>
          <span className="text-[0.625rem] text-muted-foreground">
            {deep
              ? "// scrapes site + searches Google for each platform"
              : "// scrapes homepage + /contact + /about pages"}
          </span>
        </div>
      </div>

      {isPending ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">
            {deep
              ? "Deep searching — scraping pages + querying Google..."
              : "Crawling website pages for social media links..."}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Platforms found"
              value={result.links.length}
              tone={result.links.length > 0 ? "ok" : "warn"}
            />
            <StatCard
              label="Pages scanned"
              value={result.pagesScanned.length}
              tone="neutral"
            />
            <StatCard
              label="Time"
              value={`${(result.durationMs / 1000).toFixed(1)}s`}
              tone="neutral"
            />
          </div>

          {result.links.length > 0 ? (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <p className="text-label">
                  {result.domain} · {result.links.length} social profiles
                </p>
                <button
                  type="button"
                  onClick={copyAll}
                  className="font-mono text-[0.625rem] uppercase tracking-wider text-primary hover:underline"
                >
                  {copied === "__all__" ? "copied" : "copy all"}
                </button>
              </div>

              <ul className="mt-4 divide-y divide-border">
                {result.links.map((link) => (
                  <li
                    key={link.platform}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded border px-2 py-0.5 font-mono text-[0.5625rem] uppercase tracking-wider",
                        PLATFORM_COLORS[link.platform] ??
                          "border-border bg-muted/40 text-muted-foreground",
                      )}
                    >
                      {link.platform}
                    </span>
                    <div className="min-w-0 flex-1">
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block truncate font-mono text-sm text-foreground hover:text-primary hover:underline"
                      >
                        {link.url.replace(/^https?:\/\//, "")}
                      </a>
                      <div className="flex items-center gap-2">
                        {link.handle ? (
                          <span className="font-mono text-[0.625rem] text-muted-foreground">
                            @{link.handle}
                          </span>
                        ) : null}
                        <span className="font-mono text-[0.5rem] uppercase tracking-wider text-muted-foreground/50">
                          via {SOURCE_LABELS[link.source] ?? link.source}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyUrl(link.platform, link.url)}
                      className="shrink-0 font-mono text-[0.5625rem] uppercase tracking-wider text-muted-foreground hover:text-primary"
                    >
                      {copied === link.platform ? "copied" : "copy"}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No social media links found.
              </p>
              <p className="text-comment mt-2">
                {deep
                  ? "// tried website scraping + Google search — no profiles found"
                  : "// try deep search for better results"}
              </p>
            </div>
          )}

          <details className="rounded-lg border border-border bg-card p-5">
            <summary className="cursor-pointer text-label">
              Scan details
            </summary>
            <div className="mt-3 space-y-3">
              <div>
                <p className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  Pages crawled · {result.pagesScanned.length}
                </p>
                <ul className="mt-1 space-y-0.5">
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
              </div>
              {result.googleSearched ? (
                <p className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
                  Google search · 8 platforms queried
                </p>
              ) : null}
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}

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
