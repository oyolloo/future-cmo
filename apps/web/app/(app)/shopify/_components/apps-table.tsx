"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { cn } from "@kit/ui/lib/utils";

import { DataTable } from "@/components/ui/data-table";

import { removeAppAction, syncAppAction } from "../_lib/actions";

export type AppRow = {
  appGid: string;
  appName: string;
  apiKey: string | null;
  iconUrl: string | null;
  activeInstalls: number;
  totalInstalls: number;
  totalUninstalls: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
};

const columns: ColumnDef<AppRow>[] = [
  {
    id: "name",
    header: "App",
    accessorKey: "appName",
    cell: ({ row }) => (
      <div className="flex items-center gap-3 min-w-0">
        {row.original.iconUrl ? (
          <img
            src={row.original.iconUrl}
            alt=""
            className="size-8 shrink-0 rounded-lg border border-border object-contain"
          />
        ) : (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-xs font-semibold text-muted-foreground">
            {row.original.appName.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <Link
            href={`/shopify/apps/${encodeURIComponent(row.original.appGid)}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {row.original.appName}
          </Link>
          {row.original.apiKey ? (
            <p className="mt-0.5 truncate font-mono text-[0.6875rem] text-muted-foreground">
              {row.original.apiKey}
            </p>
          ) : null}
        </div>
      </div>
    ),
  },
  {
    id: "active",
    header: "Active",
    accessorKey: "activeInstalls",
    size: 100,
    cell: ({ row }) => (
      <span
        className={cn(
          "rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider",
          row.original.activeInstalls > 0
            ? "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]"
            : "border-border bg-muted/40 text-muted-foreground",
        )}
      >
        {row.original.activeInstalls}
      </span>
    ),
  },
  {
    id: "installs",
    header: "Installs",
    accessorKey: "totalInstalls",
    size: 100,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-foreground">
        {row.original.totalInstalls}
      </span>
    ),
  },
  {
    id: "uninstalls",
    header: "Uninstalls",
    accessorKey: "totalUninstalls",
    size: 100,
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.totalUninstalls}
      </span>
    ),
  },
  {
    id: "churn",
    header: "Churn",
    accessorFn: (r) =>
      r.totalInstalls > 0
        ? Math.round((r.totalUninstalls / r.totalInstalls) * 100)
        : 0,
    size: 80,
    cell: ({ row }) => {
      const rate =
        row.original.totalInstalls > 0
          ? Math.round(
              (row.original.totalUninstalls / row.original.totalInstalls) * 100,
            )
          : 0;
      return (
        <span
          className={cn(
            "font-mono text-xs",
            rate > 30 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {rate}%
        </span>
      );
    },
  },
  {
    id: "synced",
    header: "Last sync",
    accessorFn: (r) => r.lastSyncedAt ?? "",
    size: 120,
    cell: ({ row }) => {
      if (row.original.lastSyncError && !row.original.lastSyncedAt) {
        return (
          <span className="font-mono text-[0.625rem] uppercase tracking-wider text-destructive">
            error
          </span>
        );
      }
      if (!row.original.lastSyncedAt) {
        return (
          <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
            never
          </span>
        );
      }
      return (
        <span className="font-mono text-[0.625rem] text-muted-foreground">
          {formatRelative(row.original.lastSyncedAt)}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 160,
    meta: { align: "right" },
    cell: ({ row }) => <ActionCell app={row.original} />,
  },
];

export function AppsTable({ apps }: { apps: AppRow[] }) {
  const router = useRouter();
  return (
    <DataTable
      columns={columns}
      data={apps}
      getRowId={(r) => r.appGid}
      pageSize={25}
      emptyMessage="No Shopify apps connected yet. Add one above."
      onRowClick={(r) =>
        router.push(`/shopify/apps/${encodeURIComponent(r.appGid)}`)
      }
    />
  );
}

function ActionCell({ app }: { app: AppRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const onSync = () => {
    setFeedback(null);
    startTransition(async () => {
      const result = await syncAppAction(app.appGid);
      if (result.ok) {
        setFeedback(`✓ ${result.data.eventsFetched} events`);
        router.refresh();
      } else {
        setFeedback(`✗ ${result.error.message.slice(0, 40)}`);
      }
    });
  };

  const onRemove = () => {
    if (!confirm(`Remove "${app.appName}" + events?`)) return;
    startTransition(async () => {
      await removeAppAction(app.appGid);
      router.refresh();
    });
  };

  return (
    <span className="inline-flex items-center gap-1" data-row-action>
      {feedback ? (
        <span className="mr-1 max-w-[10ch] truncate font-mono text-[0.625rem] text-muted-foreground">
          {feedback}
        </span>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onSync}
        disabled={isPending}
      >
        {isPending ? "…" : "Sync"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRemove}
        disabled={isPending}
      >
        ✕
      </Button>
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
  return `${Math.floor(hr / 24)}d ago`;
}
