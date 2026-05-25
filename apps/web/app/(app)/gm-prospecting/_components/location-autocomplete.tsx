"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { MapPinIcon as MapPin } from "@kit/ui/icons";

import { Input } from "@kit/ui/input";
import { cn } from "@kit/ui/lib/utils";

import { autocompleteLocationAction } from "../_lib/actions";
import type { LocationSuggestion } from "@/lib/maps/places";

type Props = {
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  required?: boolean;
};

export function LocationAutocomplete({
  id,
  value,
  onChange,
  placeholder,
  required,
}: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [, startTransition] = useTransition();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const lastQueryRef = useRef("");

  // Debounced fetch — 300ms after the latest keystroke.
  useEffect(() => {
    if (value.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    if (value === lastQueryRef.current) return;

    const timer = setTimeout(() => {
      lastQueryRef.current = value;
      startTransition(async () => {
        const results = await autocompleteLocationAction(value);
        setSuggestions(results.slice(0, 6));
        setActiveIndex(-1);
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  // Click-outside closes the dropdown.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const pick = (suggestion: LocationSuggestion) => {
    onChange(suggestion.text);
    setSuggestions([]);
    setOpen(false);
    lastQueryRef.current = suggestion.text;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        i <= 0 ? suggestions.length - 1 : i - 1,
      );
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const active = suggestions[activeIndex];
      if (active) pick(active);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && suggestions.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls="location-autocomplete-list"
        aria-autocomplete="list"
      />

      {showList ? (
        <ul
          id="location-autocomplete-list"
          role="listbox"
          className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {suggestions.map((s, idx) => (
            <li key={s.placeId} role="option" aria-selected={idx === activeIndex}>
              <button
                type="button"
                onMouseEnter={() => setActiveIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault(); // keep input focus
                  pick(s);
                }}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-sm px-2 py-1.5 text-left text-sm transition-colors",
                  idx === activeIndex
                    ? "bg-muted text-foreground"
                    : "text-foreground hover:bg-muted/60",
                )}
              >
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {s.mainText}
                  </span>
                  {s.secondaryText ? (
                    <span className="block truncate font-mono text-[0.6875rem] text-muted-foreground">
                      {s.secondaryText}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
