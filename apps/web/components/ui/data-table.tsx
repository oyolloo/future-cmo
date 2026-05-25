"use client";

import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { useState } from "react";

import {
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
} from "@kit/ui/icons";

declare module "@tanstack/react-table" {
  // Per-column horizontal alignment via columnDef.meta.align.
  // Applied to both <th> and <td> for consistent header/cell alignment.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "center" | "right";
  }
}

const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

import { Button } from "@kit/ui/button";
import { cn } from "@kit/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/select";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  pageSize?: number;
  pageSizeOptions?: number[];
  emptyMessage?: string;
  className?: string;
  /** Optional row id (default uses row index). Stable IDs enable correct
   *  pagination + selection state across data updates. */
  getRowId?: (row: TData, index: number) => string;
  /** Fires when a row body is clicked. Clicks on elements with
   *  `data-row-action` are ignored so embedded buttons/links still work. */
  onRowClick?: (row: TData) => void;
  /** Row selection (checkboxes) state — controlled. Pass undefined to disable. */
  rowSelection?: Record<string, boolean>;
  onRowSelectionChange?: (next: Record<string, boolean>) => void;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  pageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  emptyMessage = "No results.",
  className,
  getRowId,
  onRowClick,
  rowSelection,
  onRowSelectionChange,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      ...(rowSelection !== undefined ? { rowSelection } : {}),
    },
    onSortingChange: setSorting,
    onRowSelectionChange:
      onRowSelectionChange === undefined
        ? undefined
        : (updater) => {
            const next =
              typeof updater === "function"
                ? updater(rowSelection ?? {})
                : updater;
            onRowSelectionChange(next);
          },
    enableRowSelection: rowSelection !== undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
    getRowId,
  });

  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const totalRows = data.length;
  const startRow = totalRows === 0 ? 0 : pageIndex * currentPageSize + 1;
  const endRow = Math.min((pageIndex + 1) * currentPageSize, totalRows);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-muted/40">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sortDir = header.column.getIsSorted();
                  const align = header.column.columnDef.meta?.align ?? "left";
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        "text-label px-4 py-2.5 align-middle",
                        ALIGN_CLASS[align],
                        canSort && "cursor-pointer select-none hover:text-foreground",
                      )}
                      style={{
                        width:
                          header.getSize() === 150 ? undefined : header.getSize(),
                      }}
                      onClick={
                        canSort
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          align === "right" && "justify-end",
                          align === "center" && "justify-center",
                        )}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                        {canSort && sortDir ? (
                          <span aria-hidden>
                            {sortDir === "asc" ? "↑" : "↓"}
                          </span>
                        ) : null}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  data-selected={row.getIsSelected() ? "" : undefined}
                  className={cn(
                    "border-b border-border last:border-b-0 hover:bg-muted/30",
                    onRowClick && "cursor-pointer",
                    "data-[selected]:bg-muted/40",
                  )}
                  onClick={
                    onRowClick
                      ? (e) => {
                          // Ignore clicks on interactive cell content (buttons,
                          // links, checkboxes, inputs) so embedded actions keep
                          // working without triggering the row click.
                          const target = e.target as HTMLElement;
                          if (
                            target.closest(
                              "button, a, input, [data-row-action], [role=checkbox]",
                            )
                          )
                            return;
                          onRowClick(row.original);
                        }
                      : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = cell.column.columnDef.meta?.align ?? "left";
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-4 py-3 align-middle text-sm",
                          ALIGN_CLASS[align],
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalRows > 0 ? (
        <div
          data-print-hide
          className="flex items-center justify-between gap-4"
        >
          <p className="text-comment">
            {`// showing ${startRow}–${endRow} of ${totalRows}`}
          </p>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-label">rows</span>
              <Select
                value={String(currentPageSize)}
                onValueChange={(v: string) => table.setPageSize(Number(v))}
              >
                <SelectTrigger className="w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="text-comment min-w-[6ch] text-center">
                {pageIndex + 1} / {table.getPageCount()}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label="Next page"
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
