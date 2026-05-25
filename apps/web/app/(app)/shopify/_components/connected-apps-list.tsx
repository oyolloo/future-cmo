"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { cn } from "@kit/ui/lib/utils";

import { removeAppAction, syncAppAction } from "../_lib/actions";

type AppRow = {
  appGid: string;
  appName: string;
  apiKey: string | null;
  lastSyncedAt: string | null; // ISO
  lastSyncError: string | null;
};

type Props = {
  apps: AppRow[];
};

export function ConnectedAppsList({ apps }: Props) {
  if (apps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-background p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No Shopify apps connected yet.
        </p>
        <p className="text-comment mt-2">
          {"// add an app above to start tracking installs"}
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {apps.map((app) => (
        <AppCard key={app.appGid} app={app} />
      ))}
    </ul>
  );
}

function AppCard({ app }: { app: AppRow }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const onSync = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await syncAppAction(app.appGid);
      if (result.ok) {
        setFeedback({
          kind: "ok",
          text: `Synced ${result.data.eventsFetched} events across ${result.data.pages} page${result.data.pages === 1 ? "" : "s"} · ${result.data.shopsTracked} shops tracked.`,
        });
      } else {
        setFeedback({ kind: "err", text: result.error.message });
      }
    });
  };

  const onRemove = () => {
    if (
      !confirm(
        `Remove "${app.appName}" + all its synced events from this dashboard? (Your actual Shopify app is unaffected.)`,
      )
    )
      return;
    startTransition(async () => {
      await removeAppAction(app.appGid);
    });
  };

  return (
    <li className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/shopify/apps/${encodeURIComponent(app.appGid)}`}
            className="text-base font-medium text-primary hover:underline"
          >
            {app.appName}
          </Link>
          <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-muted-foreground">
            {app.appGid}
          </p>
          {app.apiKey ? (
            <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-muted-foreground">
              API key · {app.apiKey}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onSync}
              disabled={isPending}
            >
              {isPending ? "Syncing…" : "Sync"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              disabled={isPending}
              title="Remove from dashboard (Shopify app unaffected)"
            >
              Remove
            </Button>
          </div>
          <SyncBadge
            lastSyncedAt={app.lastSyncedAt}
            lastSyncError={app.lastSyncError}
          />
        </div>
      </div>

      {feedback ? (
        <p
          role={feedback.kind === "err" ? "alert" : "status"}
          className={cn(
            "mt-3 rounded-md border px-3 py-2 text-xs",
            feedback.kind === "err"
              ? "border-destructive/30 bg-destructive/10 text-destructive"
              : "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] text-[oklch(0.80_0.14_160)]",
          )}
        >
          {feedback.text}
        </p>
      ) : app.lastSyncError ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {app.lastSyncError}
        </p>
      ) : null}
    </li>
  );
}

function SyncBadge({
  lastSyncedAt,
  lastSyncError,
}: {
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}) {
  if (lastSyncError && !lastSyncedAt) {
    return (
      <span className="font-mono text-[0.625rem] uppercase tracking-wider text-destructive">
        sync error
      </span>
    );
  }
  if (!lastSyncedAt) {
    return (
      <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
        never synced
      </span>
    );
  }
  return (
    <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
      synced {formatRelative(lastSyncedAt)}
    </span>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toISOString().slice(0, 10);
}
