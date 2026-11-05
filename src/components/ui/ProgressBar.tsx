import { cn } from "./cn";

interface ProgressBarProps {
  /** Work done so far. */
  value: number;
  /** Total work expected; when 0 or unknown the bar is indeterminate. */
  max: number;
  label: string;
  className?: string;
}

/** Thin progress bar with a caption. Pass real counts so the bar never suggests a finished load too early. */
export function ProgressBar({ value, max, label, className }: ProgressBarProps) {
  const known = max > 0;
  const pct = known ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div role="status" aria-live="polite" className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between gap-3 text-xs text-ink-500">
        <span>{label}</span>
        {known && <span className="tabular-nums">{pct}%</span>}
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={known ? max : undefined}
        aria-valuenow={known ? Math.min(value, max) : undefined}
        className="h-1.5 overflow-hidden rounded-full bg-chip"
      >
        <div
          className={cn("h-full rounded-full bg-brand-500 transition-[width] duration-300", !known && "w-1/3 animate-pulse")}
          style={known ? { width: `${pct}%` } : undefined}
        />
      </div>
    </div>
  );
}
