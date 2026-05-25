"use client";

import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";

import { syncAppAction } from "../../../_lib/actions";

type Props = {
  appGid: string;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

export function SyncButton({ appGid, lastSyncedAt, lastSyncError }: Props) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const onSync = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await syncAppAction(appGid);
      if (result.ok) {
        setFeedback({
          kind: "ok",
          text: `Synced ${result.data.eventsFetched} events · ${result.data.shopsTracked} shops tracked.`,
        });
      } else {
        setFeedback({ kind: "err", text: result.error.message });
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onSync}
        disabled={isPending}
      >
        {isPending ? "Syncing…" : "Sync now"}
      </Button>
      <SyncStatus
        lastSyncedAt={lastSyncedAt}
        lastSyncError={lastSyncError}
        feedback={feedback}
      />
    </div>
  );
}

function SyncStatus({
  lastSyncedAt,
  lastSyncError,
  feedback,
}: {
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  feedback: { kind: "ok" | "err"; text: string } | null;
}) {
  if (feedback) {
    return (
      <p
        className={
          feedback.kind === "err"
            ? "max-w-md text-right font-mono text-[0.625rem] text-destructive"
            : "max-w-md text-right font-mono text-[0.625rem] text-[oklch(0.80_0.14_160)]"
        }
      >
        {feedback.text}
      </p>
    );
  }
  if (lastSyncError && !lastSyncedAt) {
    return (
      <p className="max-w-md text-right font-mono text-[0.625rem] text-destructive">
        {lastSyncError}
      </p>
    );
  }
  if (!lastSyncedAt) {
    return (
      <p className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
        never synced
      </p>
    );
  }
  return (
    <p className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
      last synced {formatRelative(lastSyncedAt)}
    </p>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
