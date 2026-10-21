import type { ReactNode } from "react";
import { cn } from "./cn";

/** Grey tag used for branch names and commit hashes. */
export function Chip({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return (
    <span className={cn("inline-flex items-center rounded-md bg-chip px-2 py-0.5 text-xs text-ink-700", mono && "font-mono")}>
      {children}
    </span>
  );
}

/** Keyboard key hint, for example [ ] to switch browsers. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-line-strong bg-white px-1.5 font-mono text-xs text-ink-700">
      {children}
    </kbd>
  );
}
