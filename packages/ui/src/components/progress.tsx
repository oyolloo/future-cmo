import { cn } from "../lib/utils"

type ProgressProps = React.ComponentProps<"div"> & {
  /** 0–100. Clamped. */
  value: number
  /** Optional label rendered above the bar (e.g. percentage or status). */
  label?: React.ReactNode
  /** Bar height — defaults to h-1 (4px). */
  barClassName?: string
}

/**
 * Thin determinate progress bar. Accessible (role=progressbar), clamps
 * value to 0–100. For time-based "fake" progress during slow async work,
 * pass an asymptotic value (e.g. 95) and replace the bar with results
 * when the real data lands.
 */
function Progress({
  value,
  label,
  className,
  barClassName,
  ...props
}: ProgressProps) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div
      data-slot="progress"
      className={cn("space-y-1.5", className)}
      {...props}
    >
      {label ? (
        <div className="flex items-center justify-between text-comment">
          <span>{label}</span>
          <span className="font-mono text-xs text-muted-foreground">
            {Math.round(clamped)}%
          </span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        className={cn(
          "h-1 w-full overflow-hidden rounded-full bg-muted/60",
          barClassName,
        )}
      >
        <div
          className="h-full bg-primary transition-[width] duration-200 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

export { Progress }
