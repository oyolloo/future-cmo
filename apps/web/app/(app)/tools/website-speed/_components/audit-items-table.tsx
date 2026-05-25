"use client";

import type { AuditHeading, AuditItem } from "@/lib/audit/pagespeed-details";

type Props = {
  headings: AuditHeading[];
  items: AuditItem[];
  /** Cap rows so a "Reduce unused JS" audit doesn't dump 200 rows. */
  rowLimit?: number;
};

/**
 * Render a Lighthouse audit's `details.items` as a compact table. Looks up
 * each row's value by heading.key, formats it according to heading.valueType.
 *
 * Supported value types: url, link, bytes, ms, timespanMs, numeric, text,
 * code, source-location, thumbnail. Anything else falls back to JSON.
 */
export function AuditItemsTable({ headings, items, rowLimit = 25 }: Props) {
  if (headings.length === 0 || items.length === 0) return null;

  const shown = items.slice(0, rowLimit);
  const hiddenCount = items.length - shown.length;

  return (
    <div className="mt-3 overflow-hidden rounded-md border border-border bg-background">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {headings.map((h) => (
                <th
                  key={h.key}
                  className="px-3 py-2 text-left font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground"
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((item, idx) => (
              <tr
                key={idx}
                className="border-b border-border last:border-b-0"
              >
                {headings.map((h) => (
                  <td
                    key={h.key}
                    className="max-w-[28ch] truncate px-3 py-2 align-top text-foreground"
                    title={stringifyForTitle(item[h.key])}
                  >
                    <CellValue value={item[h.key]} valueType={h.valueType} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCount > 0 ? (
        <p className="border-t border-border bg-muted/20 px-3 py-1.5 font-mono text-[0.625rem] text-muted-foreground">
          {`// + ${hiddenCount} more row${hiddenCount === 1 ? "" : "s"} hidden`}
        </p>
      ) : null}
    </div>
  );
}

// ─── Cell renderer ─────────────────────────────────────────────────────

function CellValue({
  value,
  valueType,
}: {
  value: unknown;
  valueType: string;
}) {
  if (value == null || value === "") {
    return <span className="text-muted-foreground/60">—</span>;
  }

  // Some Lighthouse cells are nested objects: {type:"url", value:"..."}, etc.
  if (typeof value === "object") {
    const wrapped = value as { type?: string; value?: unknown; url?: string };
    if (wrapped.url) {
      return <UrlLink href={String(wrapped.url)} />;
    }
    if (wrapped.value != null) {
      return <CellValue value={wrapped.value} valueType={valueType} />;
    }
    return (
      <span className="font-mono text-muted-foreground">
        {JSON.stringify(value).slice(0, 40)}
      </span>
    );
  }

  switch (valueType) {
    case "url":
    case "link":
      return <UrlLink href={String(value)} />;
    case "bytes":
      return (
        <span className="font-mono">
          {formatBytes(Number(value))}
        </span>
      );
    case "ms":
    case "timespanMs":
      return (
        <span className="font-mono">{formatMs(Number(value))}</span>
      );
    case "numeric":
      return (
        <span className="font-mono">
          {typeof value === "number" ? value.toLocaleString() : String(value)}
        </span>
      );
    case "code":
      return (
        <code className="rounded bg-muted/40 px-1 font-mono text-[0.6875rem]">
          {String(value)}
        </code>
      );
    case "source-location":
      return (
        <span className="font-mono text-[0.6875rem]">
          {String(value)}
        </span>
      );
    case "thumbnail":
      return null; // images skipped to keep table compact
    case "text":
    default:
      return <span>{String(value)}</span>;
  }
}

function UrlLink({ href }: { href: string }) {
  let display = href;
  try {
    const u = new URL(href);
    display = u.pathname + (u.search || "");
    if (display.length > 40) display = display.slice(0, 37) + "…";
  } catch {
    /* not a parseable URL — show raw */
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {display}
    </a>
  );
}

function stringifyForTitle(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "";
    }
  }
  return String(value);
}

function formatBytes(bytes: number): string {
  if (!isFinite(bytes)) return String(bytes);
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${Math.round(bytes)} B`;
}

function formatMs(ms: number): string {
  if (!isFinite(ms)) return String(ms);
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${Math.round(ms)} ms`;
}
