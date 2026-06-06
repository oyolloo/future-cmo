"use client";

import { Input } from "@kit/ui/input";
import { cn } from "@kit/ui/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/select";

import type { CustomField, CustomFieldKey } from "../_lib/custom-fields-config";
import { FIELD_OPTIONS, FIELD_LABEL_LOOKUP } from "../_lib/custom-fields-config";

type Props = {
  fields: CustomField[];
  onChange: (next: CustomField[]) => void;
  disabled?: boolean;
};

const newFieldId = () =>
  `f_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36)}`;

export function CustomFieldsRepeater({ fields, onChange, disabled }: Props) {
  const add = () =>
    onChange([
      ...fields,
      { id: newFieldId(), label: "", value: "" as CustomFieldKey },
    ]);

  const remove = (id: string) =>
    onChange(fields.filter((f) => f.id !== id));

  const update = (id: string, patch: Partial<CustomField>) =>
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const handleValueChange = (id: string, value: CustomFieldKey) => {
    const current = fields.find((f) => f.id === id);
    if (!current) return;
    // If label is blank, auto-fill from value default
    const nextLabel = current.label.trim()
      ? current.label
      : FIELD_LABEL_LOOKUP[value] ?? value;
    update(id, { value, label: nextLabel });
  };

  const handleLabelBlur = (id: string) => {
    const current = fields.find((f) => f.id === id);
    if (!current) return;
    // If label is empty on blur AND a value is selected, auto-fill
    if (!current.label.trim() && current.value) {
      update(id, { label: FIELD_LABEL_LOOKUP[current.value] ?? current.value });
    }
  };

  return (
    <div className="space-y-3">
      {fields.length === 0 ? (
        <p className="text-comment">
          {"// add fields to filter the CSV — blank = export all default columns"}
        </p>
      ) : null}

      {fields.map((f, i) => (
        <div
          key={f.id}
          className="grid gap-2 rounded-md border border-border bg-background p-3 sm:grid-cols-[auto_1fr_1.5fr_auto]"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 font-mono text-[0.625rem] text-muted-foreground">
            {i + 1}
          </span>
          <Input
            type="text"
            placeholder="Column label (auto-fills from value if blank)"
            value={f.label}
            onChange={(e) => update(f.id, { label: e.target.value })}
            onBlur={() => handleLabelBlur(f.id)}
            disabled={disabled}
          />
          <Select
            value={f.value || undefined}
            onValueChange={(v) => handleValueChange(f.id, v as CustomFieldKey)}
            disabled={disabled}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder="Select data field…" />
            </SelectTrigger>
            <SelectContent>
              {FIELD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={() => remove(f.id)}
            disabled={disabled}
            className={cn(
              "rounded-md border border-border px-2 py-1 font-mono text-[0.625rem] uppercase tracking-wider transition-colors",
              disabled
                ? "text-muted-foreground/30"
                : "text-muted-foreground hover:border-destructive/40 hover:text-destructive",
            )}
            aria-label="Remove field"
          >
            ✕
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="w-full rounded-md border border-dashed border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
      >
        + Add custom field
      </button>
    </div>
  );
}
