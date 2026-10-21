import type { ReactNode } from "react";
import { Info } from "./Icons";
import { cn } from "./cn";

interface WidgetProps {
  title: string;
  /** Tooltip text for the info icon next to the title. */
  info?: string;
  /** Right-aligned header content, such as a menu button or a segmented control. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Dashboard card: bold title, info icon, optional header action. */
export function Widget({ title, info, action, children, className }: WidgetProps) {
  return (
    <section className={cn("rounded-lg border border-line bg-white p-5", className)}>
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-[15px] font-semibold text-ink-900">
          {title}
          {info && (
            <span title={info} className="text-ink-400" aria-label={info} role="img">
              <Info size={14} />
            </span>
          )}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

/** Large figure with a muted caption on the same baseline ("54  54 out of 546 are flaky"). */
export function BigNumber({ value, caption }: { value: ReactNode; caption: string }) {
  return (
    <p className="flex items-baseline gap-2">
      <span className="text-3xl font-semibold tracking-tight text-ink-900 tabular-nums">{value}</span>
      <span className="text-xs text-ink-500">{caption}</span>
    </p>
  );
}

export interface Segment {
  key: string;
  label: string;
  value: number;
  /** Tailwind background class for the segment and its legend dot. */
  color: string;
}

/** Thin multi-color proportion bar. Renders nothing meaningful when total is zero. */
export function StackedBar({ segments }: { segments: Segment[] }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  return (
    <div className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-chip" role="img" aria-label="Proportion bar">
      {total > 0 &&
        segments
          .filter((s) => s.value > 0)
          .map((s) => <div key={s.key} className={s.color} style={{ width: `${(s.value / total) * 100}%` }} />)}
    </div>
  );
}

/** Dot, label and right-aligned figure rows under a StackedBar. */
export function LegendRows({ segments }: { segments: Segment[] }) {
  return (
    <ul className="space-y-3 text-sm">
      {segments.map((s) => (
        <li key={s.key} className="flex items-center gap-3">
          <span className={cn("h-2 w-2 rounded-full", s.color)} />
          <span className="flex-1 text-ink-700">{s.label}</span>
          <span className="tabular-nums text-ink-700">{s.value}</span>
        </li>
      ))}
    </ul>
  );
}

/** Soft tinted info banner inside a widget ("Self healed (2)  View Tests"). */
export function InlineAction({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-md bg-surface px-3 py-3 text-sm text-ink-700">
      {children}
      {action}
    </div>
  );
}
