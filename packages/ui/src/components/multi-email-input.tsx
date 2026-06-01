"use client";

import { useRef, useState } from "react";

import { cn } from "../lib/utils";

// ─── Validation ──────────────────────────────────────────────────────

/** Simple but strict-enough email regex. Avoids common false positives. */
const EMAIL_RE =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/** Loose regex for *extracting* emails from arbitrary text (paste). */
const EMAIL_EXTRACT_RE =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/**
 * Extract every email-looking token from arbitrary text. Handles:
 *  - "John Doe <john@example.com>"
 *  - "jane@example.com, bob@x.io"
 *  - newlines, tabs, semicolons as separators
 *  - garbage text around emails
 */
export function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_EXTRACT_RE) ?? [];
  return [...new Set(matches.map((m) => m.toLowerCase()))];
}

// ─── Component ───────────────────────────────────────────────────────

export type MultiEmailInputProps = {
  value: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Cap the number of recipients (omit for unlimited). */
  max?: number;
  className?: string;
};

export function MultiEmailInput({
  value,
  onChange,
  placeholder = "name@example.com, ...",
  disabled,
  max,
  className,
}: MultiEmailInputProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addEmails = (raw: string) => {
    const found = extractEmails(raw);
    if (found.length === 0) return false;
    const merged = [...value];
    for (const e of found) {
      if (!merged.includes(e)) merged.push(e);
    }
    const capped = max ? merged.slice(0, max) : merged;
    onChange(capped);
    return true;
  };

  const commitDraft = () => {
    const trimmed = draft.trim().replace(/[,;\s]+$/, "");
    if (!trimmed) {
      setDraft("");
      return;
    }
    addEmails(trimmed);
    setDraft("");
  };

  const removeAt = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (draft.trim()) {
        e.preventDefault();
        commitDraft();
      }
    } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
      e.preventDefault();
      removeAt(value.length - 1);
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text");
    if (extractEmails(pasted).length > 0) {
      e.preventDefault();
      addEmails(pasted);
      setDraft("");
    }
  };

  const invalidDraft = draft.trim().length > 0 && !isValidEmail(draft.trim());

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary",
        disabled && "opacity-60",
        className,
      )}
    >
      {value.map((email, i) => {
        const valid = isValidEmail(email);
        return (
          <span
            key={`${email}-${i}`}
            className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[0.6875rem]",
              valid
                ? "border-[oklch(0.72_0.14_160/30%)] bg-[oklch(0.72_0.14_160/10%)] text-[oklch(0.80_0.14_160)]"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
            title={valid ? email : `Invalid: ${email}`}
          >
            {email}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeAt(i);
              }}
              disabled={disabled}
              aria-label={`Remove ${email}`}
              className="opacity-60 transition-opacity hover:opacity-100"
            >
              ✕
            </button>
          </span>
        );
      })}

      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={commitDraft}
        onPaste={onPaste}
        disabled={disabled || (max ? value.length >= max : false)}
        placeholder={value.length === 0 ? placeholder : ""}
        className={cn(
          "min-w-[120px] flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground",
          invalidDraft && "text-destructive",
        )}
      />
    </div>
  );
}
