import type { AutomationBusinessRow } from "@/lib/automation/processor";

import type { CustomFieldStored } from "./custom-fields-config";

const DEFAULT_COLUMNS: Array<{ key: keyof AutomationBusinessRow; label: string }> = [
  { key: "taskKeyword", label: "Keyword" },
  { key: "taskLocation", label: "Location" },
  { key: "name", label: "Business Name" },
  { key: "address", label: "Address" },
  { key: "phone", label: "Phone" },
  { key: "website", label: "Website" },
  { key: "rating", label: "Rating" },
  { key: "reviewCount", label: "Reviews" },
  { key: "conversionScore", label: "Conversion Score" },
  { key: "conversionBand", label: "Band" },
  { key: "hasWebsite", label: "Has Website" },
  { key: "types", label: "Categories" },
  { key: "googleMapsUri", label: "Google Maps URL" },
  { key: "placeId", label: "Place ID" },
];

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = Array.isArray(value) ? value.join(", ") : String(value);
  // Excel-safe: wrap in quotes if contains comma, quote, or newline; escape inner quotes
  if (/[",\n\r]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build CSV from business rows.
 *
 * When `customFields` is provided (non-empty), columns + labels come from it.
 * Otherwise all default columns are used.
 */
export function rowsToCsv(
  rows: AutomationBusinessRow[],
  customFields?: CustomFieldStored[] | null,
): string {
  const columns: Array<{ key: keyof AutomationBusinessRow; label: string }> =
    customFields && customFields.length > 0
      ? customFields.map((f) => ({
          key: f.value as keyof AutomationBusinessRow,
          label: f.label,
        }))
      : DEFAULT_COLUMNS;

  const header = columns.map((c) => csvCell(c.label)).join(",");
  const body = rows
    .map((r) => columns.map((c) => csvCell(r[c.key])).join(","))
    .join("\n");
  // BOM so Excel detects UTF-8
  return `﻿${header}\n${body}\n`;
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
