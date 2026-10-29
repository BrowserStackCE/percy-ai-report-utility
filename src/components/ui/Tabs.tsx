import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { cn } from "./cn";

export interface TabItem {
  to: string;
  label: string;
  icon?: ReactNode;
  end?: boolean;
  /** Small trailing figure such as a count. */
  count?: number;
}

/** Route-driven tab bar with an underline on the active tab. */
export function Tabs({ items, ariaLabel }: { items: TabItem[]; ariaLabel: string }) {
  return (
    <nav aria-label={ariaLabel} className="flex w-full items-stretch gap-1 overflow-x-auto border-b border-line">
      {items.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.end}
          className={({ isActive }) =>
            cn(
              "-mb-px flex min-h-11 min-w-max flex-1 items-center justify-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:flex-none",
              isActive
                ? "border-brand-500 text-brand-700"
                : "border-transparent text-ink-500 hover:text-ink-900",
            )
          }
        >
          {t.icon}
          {t.label}
          {t.count !== undefined && (
            <span className="rounded bg-chip px-1.5 text-xs tabular-nums text-ink-700">{t.count}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
