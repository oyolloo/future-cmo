"use client";

import { FileTextIcon as FileText } from "@kit/ui/icons";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 font-mono text-xs uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
      title="Opens the print dialog — choose 'Save as PDF' to download"
    >
      <FileText className="size-3.5" />
      <span>Export PDF</span>
    </button>
  );
}
