"use client";

import { StarIcon } from "@kit/ui/icons";
import { cn } from "@kit/ui/lib/utils";

type Size = "xs" | "sm" | "md";

const SIZE_CLASS: Record<Size, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
};

const GAP_CLASS: Record<Size, string> = {
  xs: "gap-1",
  sm: "gap-1.5",
  md: "gap-2",
};

export type StarRatingProps = {
  /** 0–5 rating. Fractional values render half-filled stars. */
  rating: number | null;
  size?: Size;
  /** Show the numeric value next to the stars. */
  showValue?: boolean;
  /** Override for the numeric value's formatter. */
  valueLabel?: string;
  className?: string;
};

/**
 * 5-star rating with proportional fill — fractional ratings render with
 * the rightmost partial star clipped to the correct width. Uses the same
 * HugeIcons star primitive as the rest of the app.
 */
export function StarRating({
  rating,
  size = "sm",
  showValue = true,
  valueLabel,
  className,
}: StarRatingProps) {
  if (rating == null) {
    return (
      <span className={cn("text-muted-foreground", className)}>—</span>
    );
  }

  const safe = Math.max(0, Math.min(5, rating));
  const iconSize = SIZE_CLASS[size];

  return (
    <span
      className={cn("inline-flex items-center", GAP_CLASS[size], className)}
      aria-label={`${safe.toFixed(1)} out of 5 stars`}
    >
      <span className="inline-flex" role="img" aria-hidden>
        {Array.from({ length: 5 }).map((_, i) => {
          // How much of THIS star (i) should be filled: 0–1.
          const fillRatio = Math.max(0, Math.min(1, safe - i));
          return <StarPart key={i} fillRatio={fillRatio} sizeClass={iconSize} />;
        })}
      </span>
      {showValue ? (
        <span className="font-mono text-xs text-muted-foreground">
          {valueLabel ?? safe.toFixed(1)}
        </span>
      ) : null}
    </span>
  );
}

function StarPart({
  fillRatio,
  sizeClass,
}: {
  fillRatio: number;
  sizeClass: string;
}) {
  return (
    <span className={cn("relative inline-block shrink-0", sizeClass)}>
      {/* Empty backdrop — always rendered. */}
      <StarIcon
        className={cn(
          sizeClass,
          "absolute inset-0 fill-transparent text-muted-foreground/40",
        )}
      />
      {/* Filled overlay clipped to the correct horizontal portion. */}
      {fillRatio > 0 ? (
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${fillRatio * 100}%` }}
          aria-hidden
        >
          <StarIcon
            className={cn(sizeClass, "fill-primary text-primary")}
          />
        </span>
      ) : null}
    </span>
  );
}
