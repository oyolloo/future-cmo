"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { BuildingIcon as Building2 } from "@kit/ui/icons";

import { DataTable } from "@/components/ui/data-table";
import { StarRating } from "@/components/ui/star-rating";

import type { RankedBusiness } from "./marketing-audit-report";

function buildColumns(basePath: string): ColumnDef<RankedBusiness>[] {
  return [
    {
      id: "rank",
      header: "Rank",
      enableSorting: false,
      size: 64,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {String(row.index + 1).padStart(2, "0")}
        </span>
      ),
    },
    {
      id: "business",
      header: "Business Name",
      accessorFn: (b) => b.details.name,
      cell: ({ row }) => {
        const { details } = row.original;
        return (
          <div>
            {/* Anchor → middle-click + cmd-click open in new tab.
                Absolute href because relative `business/${placeId}` on
                /reports/[id] resolves to /reports/business/... per URL
                spec (no trailing slash = wrong directory). DataTable
                excludes anchor clicks from row click so we don't
                double-navigate. */}
            <Link
              href={`${basePath}/${details.placeId}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {details.name}
            </Link>
            {details.formattedAddress ? (
              <p className="truncate font-mono text-xs text-muted-foreground">
                {details.formattedAddress}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "photos",
      header: "GBP Photos",
      accessorFn: (b) => b.details.photoNames.length,
      size: 112,
      cell: ({ row }) => {
        const count = row.original.details.photoNames.length;
        if (count === 0)
          return <span className="text-muted-foreground">No</span>;
        return (
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <Building2 className="size-3.5 text-muted-foreground" />
            {count}
          </span>
        );
      },
    },
    {
      id: "reviews",
      header: "GBP Reviews",
      accessorFn: (b) => b.details.reviewCount ?? 0,
      size: 112,
      cell: ({ row }) => <>{row.original.details.reviewCount ?? 0}</>,
    },
    {
      id: "rating",
      header: "GBP Star Rating",
      accessorFn: (b) => b.details.rating ?? 0,
      size: 176,
      cell: ({ row }) => {
        const r = row.original.details.rating;
        if (r == null) return <span className="text-muted-foreground">—</span>;
        return <StarRating rating={r} />;
      },
    },
  ];
}

export function BusinessTable({
  businesses,
  businessDetailBasePath,
}: {
  businesses: RankedBusiness[];
  businessDetailBasePath: string;
}) {
  const router = useRouter();
  const columns = buildColumns(businessDetailBasePath);
  return (
    <DataTable
      columns={columns}
      data={businesses}
      getRowId={(b) => b.details.placeId}
      pageSize={50}
      pageSizeOptions={[10, 25, 50, 100]}
      emptyMessage="No details could be fetched for the selected businesses."
      onRowClick={(b) =>
        router.push(`${businessDetailBasePath}/${b.details.placeId}`)
      }
    />
  );
}

