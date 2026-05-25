"use client";

import { useRef, useState } from "react";

import { cn } from "@kit/ui/lib/utils";

function hiRes(url: string): string {
  return url.replace(/\?.*$/, "");
}

function thumb(url: string): string {
  return url.replace(/\?.*$/, "") + "?width=320&height=180";
}

export function ListingGallery({
  screenshots,
  appName,
}: {
  screenshots: string[];
  appName: string;
}) {
  const [selected, setSelected] = useState(0);
  const current = screenshots[selected];
  const stripRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    stripRef.current?.scrollBy({
      left: dir === "left" ? -240 : 240,
      behavior: "smooth",
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <p className="text-label">
        App Store screenshots · {screenshots.length}
      </p>

      {current ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-border bg-muted/30">
          <img
            src={hiRes(current)}
            alt={`${appName} screenshot ${selected + 1}`}
            className="w-full object-contain"
          />
        </div>
      ) : null}

      {screenshots.length > 1 ? (
        <div className="relative mt-3">
          <button
            type="button"
            onClick={() => scroll("left")}
            className="absolute -left-1 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-sm text-muted-foreground shadow-md hover:text-foreground"
            aria-label="Scroll left"
          >
            ‹
          </button>

          <div
            ref={stripRef}
            className="scrollbar-hide flex gap-2 overflow-x-auto px-6"
          >
            {screenshots.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setSelected(i)}
                className={cn(
                  "shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                  i === selected
                    ? "border-primary"
                    : "border-border hover:border-muted-foreground/40",
                )}
              >
                <img
                  src={thumb(src)}
                  alt={`Thumbnail ${i + 1}`}
                  className="h-16 w-24 object-cover"
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scroll("right")}
            className="absolute -right-1 top-1/2 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-sm text-muted-foreground shadow-md hover:text-foreground"
            aria-label="Scroll right"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
