import type { ReactNode } from "react";
import { cn } from "./cn";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon: ReactNode;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** Icon segmented toggle, like the split / overlay view switch in the review header. */
export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex rounded-lg border border-line-strong bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-label={o.label}
          title={o.label}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-8 w-9 items-center justify-center rounded-md text-ink-700 transition-colors",
            o.value === value ? "bg-brand-50 text-brand-600" : "hover:bg-chip",
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

interface OptionTileGroupProps<T extends string> {
  title: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
  /** Tile width style, for example "w-16" for icon tiles or "px-8" for text tiles. */
  tileClassName?: string;
}

/** Labeled row of selectable tiles (BROWSERS / WIDTHS in the selector popover). */
export function OptionTileGroup<T extends string>({
  title,
  value,
  options,
  onChange,
  tileClassName,
}: OptionTileGroupProps<T>) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={title}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex h-12 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors",
              o.value === value
                ? "border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500"
                : "border-line-strong bg-white text-ink-700 hover:bg-surface",
              tileClassName,
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
