import type { ReactNode } from "react";
import { Button } from "./Button";

interface FilterPanelProps {
  title?: string;
  onReset: () => void;
  canReset: boolean;
  children: ReactNode;
}

/** Container for grouped filters with a Reset action in the header. */
export function FilterPanel({ title = "Filters", onReset, canReset, children }: FilterPanelProps) {
  return (
    <div className="w-80">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        <Button variant="ghost" className="h-7 px-2 text-ink-500" disabled={!canReset} onClick={onReset}>
          Reset
        </Button>
      </div>
      <div className="divide-y divide-line">{children}</div>
    </div>
  );
}

export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="px-5 py-4">
      <legend className="mb-1 text-base font-semibold text-ink-900">{title}</legend>
      <div className="space-y-0.5">{children}</div>
    </fieldset>
  );
}
