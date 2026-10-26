import type { ReactNode } from "react";
import { cn } from "./cn";

export interface TabBarItem<T extends string> {
  value: T;
  label: string;
  /** Small trailing figure such as a count. */
  count?: number | string;
  icon?: ReactNode;
}

interface TabBarProps<T extends string> {
  items: TabBarItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** State-driven tab bar (no routing) with the same underline style as the route Tabs. */
export function TabBar<T extends string>({ items, value, onChange, ariaLabel }: TabBarProps<T>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex items-center gap-1 border-b border-line">
      {items.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            id={`tab-${t.value}`}
            aria-selected={active}
            aria-controls={`panel-${t.value}`}
            onClick={() => onChange(t.value)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-brand-500 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-900",
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span className="rounded bg-chip px-1.5 text-xs tabular-nums text-ink-700">{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
