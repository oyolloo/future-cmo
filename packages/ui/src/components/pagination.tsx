"use client"

import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from "../icons"
import { cn } from "../lib/utils"

import { Button } from "./button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select"

export type PaginationProps = {
  /** 0-indexed current page. */
  pageIndex: number
  /** Total number of pages (>= 1). */
  pageCount: number
  /** Items per page. */
  pageSize: number
  /** Selectable page sizes. Pass [] to hide the page-size selector. */
  pageSizeOptions?: number[]
  /** Total row count — shown as "X–Y of Z". Omit to hide the range label. */
  totalRows?: number
  onPageIndexChange: (next: number) => void
  onPageSizeChange?: (next: number) => void
  /** Print-aware hiding. Pass false to render in print output too. */
  hideOnPrint?: boolean
  className?: string
}

/**
 * Reusable pagination controls — extracted from DataTable so non-table
 * lists (e.g. paginated review cards) can use the same affordances.
 *
 * Pure presentation: parent owns page-index state. Renders left "range"
 * label, right pageSize selector + prev/next, and a "current / total"
 * indicator. Print-hides by default.
 */
export function Pagination({
  pageIndex,
  pageCount,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  totalRows,
  onPageIndexChange,
  onPageSizeChange,
  hideOnPrint = true,
  className,
}: PaginationProps) {
  const canPrev = pageIndex > 0
  const canNext = pageIndex < pageCount - 1
  const safePageCount = Math.max(pageCount, 1)

  const startRow =
    totalRows == null
      ? null
      : totalRows === 0
        ? 0
        : pageIndex * pageSize + 1
  const endRow =
    totalRows == null
      ? null
      : Math.min((pageIndex + 1) * pageSize, totalRows)

  return (
    <div
      data-print-hide={hideOnPrint ? "" : undefined}
      className={cn(
        "flex items-center justify-between gap-4",
        className,
      )}
    >
      {totalRows != null ? (
        <p className="text-comment">
          {`// showing ${startRow}–${endRow} of ${totalRows}`}
        </p>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-3">
        {onPageSizeChange && pageSizeOptions.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-label">rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v: string) => onPageSizeChange(Number(v))}
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
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onPageIndexChange(pageIndex - 1)}
            disabled={!canPrev}
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="size-3.5" />
          </Button>
          <span className="text-comment min-w-[6ch] text-center">
            {pageIndex + 1} / {safePageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={() => onPageIndexChange(pageIndex + 1)}
            disabled={!canNext}
            aria-label="Next page"
          >
            <ChevronRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
