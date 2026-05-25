"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@kit/ui/button";
import { cn } from "@kit/ui/lib/utils";

import { DataTable } from "@/components/ui/data-table";

import { deleteReportAction } from "../_lib/actions";

export type ReportRow = {
  id: string;
  name: string;
  businessCount: number;
  overallScore: number;
  createdAt: Date;
};

export function ReportsTable({ rows }: { rows: ReportRow[] }) {
  const columns: ColumnDef<ReportRow>[] = [
    {
      id: "name",
      header: "Report",
      accessorKey: "name",
      cell: ({ row }) => (
        <Link
          href={`/gm-prospecting/reports/${row.original.id}`}
          className="text-sm font-medium text-primary hover:underline"
        >
          {row.original.name}
        </Link>
      ),
    },
    {
      id: "businessCount",
      header: "Businesses",
      accessorKey: "businessCount",
      size: 120,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.businessCount}
        </span>
      ),
    },
    {
      id: "overall",
      header: "Overall",
      accessorKey: "overallScore",
      size: 140,
      cell: ({ row }) => <OverallBadge score={row.original.overallScore} />,
    },
    {
      id: "createdAt",
      header: "Created",
      accessorKey: "createdAt",
      size: 180,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {formatRelative(row.original.createdAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      size: 100,
      meta: { align: "right" },
      cell: ({ row }) => <DeleteCell id={row.original.id} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowId={(r) => r.id}
      pageSize={25}
      emptyMessage="No reports yet."
    />
  );
}

function DeleteCell({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  const onDelete = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteReportAction(id);
      if (result.ok) {
        router.refresh();
      } else {
        setConfirming(false);
      }
    });
  };

  return (
    <Button
      type="button"
      size="sm"
      variant={confirming ? "destructive" : "ghost"}
      onClick={onDelete}
      onBlur={() => setConfirming(false)}
      disabled={isPending}
      data-row-action
    >
      {isPending ? "Deleting…" : confirming ? "Confirm?" : "Delete"}
    </Button>
  );
}

function OverallBadge({ score }: { score: number }) {
  const band = score >= 80 ? "strong" : score >= 50 ? "warming" : "weak";
  const styles: Record<typeof band, string> = {
    weak: "border-destructive/30 bg-destructive/10 text-destructive",
    warming:
      "border-[oklch(0.78_0.14_90/30%)] bg-[oklch(0.78_0.14_90/15%)] text-[oklch(0.85_0.14_90)]",
    strong:
      "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/15%)] text-[oklch(0.80_0.14_160)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[0.6875rem] uppercase tracking-wider",
        styles[band],
      )}
    >
      {score}%
    </span>
  );
}

function formatRelative(date: Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toISOString().slice(0, 10);
}
