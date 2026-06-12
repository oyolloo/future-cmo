"use client";

import type { ApiKey } from "@kit/database/schema";
import { Button } from "@kit/ui/button";

type Props = {
  apiKey: ApiKey;
  onRevoke: () => void;
  revoking: boolean;
};

function timeAgo(date: Date | null): string {
  if (!date) return "Never";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function KeyRow({ apiKey, onRevoke, revoking }: Props) {
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{apiKey.name}</p>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">
            {apiKey.keyPrefix}…
          </code>
          <span>
            {apiKey.permissions.includes("*")
              ? "All permissions"
              : apiKey.permissions.join(", ")}
          </span>
          <span>·</span>
          <span>Last used: {timeAgo(apiKey.lastUsedAt)}</span>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
        onClick={onRevoke}
        disabled={revoking}
      >
        Revoke
      </Button>
    </div>
  );
}
