import type { ReactNode } from "react";
import { InfoTip } from "./InfoTip";
import { cn } from "./cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-card)]", className)}>{children}</div>;
}

export function StatCard({ label, value, hint, info }: { label: string; value: ReactNode; hint: string; info?: string }) {
  return (
    <Card className="p-5">
      <div className="flex min-h-10 items-start gap-1.5 text-sm font-medium leading-5 text-ink-500">
        {label}
        {info && <InfoTip title={label}>{info}</InfoTip>}
      </div>
      <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-ink-900 tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-ink-400">{hint}</p>
    </Card>
  );
}

export type AccentTone = "brand" | "mint" | "warn" | "danger" | "info" | "teal";

/** Class sets for each accent: tinted surface, border, strong text, solid bar and icon chip. */
export const accentStyles: Record<AccentTone, { surface: string; border: string; text: string; bar: string; chip: string }> = {
  brand: { surface: "bg-brand-50", border: "border-brand-300/60", text: "text-brand-700", bar: "bg-brand-500", chip: "bg-brand-500" },
  mint: { surface: "bg-mint-50", border: "border-mint-300/70", text: "text-mint-700", bar: "bg-mint-500", chip: "bg-mint-500" },
  warn: { surface: "bg-warn-50", border: "border-warn-700/25", text: "text-warn-700", bar: "bg-warn-500", chip: "bg-warn-500" },
  danger: { surface: "bg-danger-50", border: "border-danger-600/25", text: "text-danger-600", bar: "bg-danger-600", chip: "bg-danger-600" },
  info: { surface: "bg-info-50", border: "border-info-500/30", text: "text-info-700", bar: "bg-info-500", chip: "bg-info-500" },
  teal: { surface: "bg-teal-50", border: "border-teal-500/30", text: "text-teal-700", bar: "bg-teal-500", chip: "bg-teal-500" },
};

/** A KPI tile with a coloured top edge, tinted surface and optional icon. Use instead of StatCard where colour helps. */
export function AccentStat({
  label,
  value,
  hint,
  tone = "brand",
  icon,
  info,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: AccentTone;
  icon?: ReactNode;
  info?: string;
}) {
  const a = accentStyles[tone];
  return (
    <div className={cn("relative overflow-hidden rounded-[var(--radius-card)] border p-5 shadow-[var(--shadow-card)]", a.surface, a.border)}>
      <span aria-hidden="true" className={cn("absolute inset-x-0 top-0 h-1", a.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-h-10 items-start gap-1.5 text-sm font-medium leading-5 text-ink-700">
          {label}
          {info && <InfoTip title={label}>{info}</InfoTip>}
        </div>
        {icon && <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--color-on-brand)]", a.chip)}>{icon}</span>}
      </div>
      <p className={cn("mt-1 text-3xl font-semibold leading-none tracking-tight tabular-nums", a.text)}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/** Banner that opens a major part of a page: gradient strip, icon, title and a line of context. */
export function SectionBanner({ icon, title, description, tone = "brand", action }: { icon?: ReactNode; title: string; description?: ReactNode; tone?: AccentTone; action?: ReactNode }) {
  const a = accentStyles[tone];
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border px-5 py-4", a.surface, a.border)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--color-on-brand)]", a.chip)}>{icon}</span>}
        <div className="min-w-0">
          <h2 className={cn("text-xl font-semibold", a.text)}>{title}</h2>
          {description && <p className="text-sm text-ink-700">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** Small uppercase label used above sections (TEAM, BROWSERS, WIDTHS, BUILD). */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-wider text-ink-500", className)}>{children}</p>
  );
}

/** Light informational notice, like "No significant visual changes in this build". */
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-line bg-card px-3 py-2 text-xs text-ink-700">
      {children}
    </div>
  );
}