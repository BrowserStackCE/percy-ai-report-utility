import type { ReactNode } from "react";
import { cn } from "./cn";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-line bg-white", className)}>{children}</div>;
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-ink-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink-900">{value}</p>
      <p className="mt-1 text-xs text-ink-400">{hint}</p>
    </Card>
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
    <div className="flex items-start gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink-700">
      {children}
    </div>
  );
}
