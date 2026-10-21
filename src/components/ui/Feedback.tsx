import type { ReactNode } from "react";

export function ImagePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed border-line-strong bg-surface text-sm text-ink-400">
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-2xl font-semibold text-ink-900">{title}</h1>
      <p className="mt-2 text-sm text-ink-500">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
