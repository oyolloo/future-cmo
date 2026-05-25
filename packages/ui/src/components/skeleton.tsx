import { cn } from "../lib/utils"

/**
 * Loading placeholder — pulses in the muted color. Pair with explicit
 * width/height utilities (or wrap in a sized container) so it occupies
 * the same footprint as the real content.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
      {...props}
    />
  )
}

export { Skeleton }
