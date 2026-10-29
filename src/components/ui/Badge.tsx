import type { ReactNode } from "react";
import type { Classification } from "../../types";
import { cn } from "./cn";

type Tone = "mint" | "danger" | "warn" | "neutral" | "brand";

const tones: Record<Tone, string> = {
  mint: "bg-mint-50 text-mint-700 border-mint-300",
  danger: "bg-danger-50 text-danger-600 border-danger-600/30",
  warn: "bg-warn-50 text-warn-700 border-warn-700/30",
  neutral: "bg-chip text-ink-500 border-line-strong",
  brand: "bg-brand-50 text-brand-700 border-brand-300",
};

/** Rounded status pill, like the "Approved" pill in the build header. */
export function StatusPill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", tones[tone])}>
      {children}
    </span>
  );
}

const classificationMeta: Record<Classification, { label: string; tone: Tone }> = {
  likely_bug: { label: "Likely bug", tone: "danger" },
  not_bug: { label: "Not a bug", tone: "mint" },
  not_classified: { label: "Not classified", tone: "neutral" },
};

export const classificationLabels = Object.fromEntries(
  Object.entries(classificationMeta).map(([k, v]) => [k, v.label]),
) as Record<Classification, string>;

/** Bug classification pill. Never implies severity. */
export function ClassificationBadge({ classification }: { classification: Classification }) {
  const { label, tone } = classificationMeta[classification];
  return <StatusPill tone={tone}>{label}</StatusPill>;
}

/** Small "New" marker used next to nav items. */
export function NewTag() {
  return <span className="rounded-md bg-mint-50 px-1.5 py-0.5 text-[11px] font-medium text-mint-700">New</span>;
}
