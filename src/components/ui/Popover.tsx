import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "./cn";

interface PopoverProps {
  /** Render the trigger. Spread `triggerProps` onto the button for correct a11y wiring. */
  trigger: (args: {
    open: boolean;
    toggle: () => void;
    triggerProps: { "aria-haspopup": "dialog"; "aria-expanded": boolean; "aria-controls": string };
  }) => ReactNode;
  /** Panel content. Receives `close` so items can dismiss the popover. */
  children: (args: { close: () => void }) => ReactNode;
  align?: "left" | "right";
  panelClassName?: string;
}

/** Anchored floating panel with click-outside and Escape dismissal. */
export function Popover({ trigger, children, align = "left", panelClassName }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = () => setOpen((v) => !v);

  return (
    <div ref={rootRef} className="relative inline-block">
      {trigger({
        open,
        toggle,
        triggerProps: { "aria-haspopup": "dialog", "aria-expanded": open, "aria-controls": panelId },
      })}
      {open && (
        <div
          id={panelId}
          role="dialog"
          className={cn(
            "pop-in absolute z-30 mt-2 rounded-xl border border-line bg-card shadow-popover",
            align === "right" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  );
}
