import { useEffect, useRef, type ReactNode } from "react";
import { Close } from "./Icons";
import { IconButton } from "./Button";
import { cn } from "./cn";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Width utility, for example "w-[28rem]". */
  widthClassName?: string;
}

/**
 * Right-side drawer. Always mounted so it can animate both ways; `inert` removes it
 * from the tab order and the accessibility tree while closed. Closes on Escape and
 * on backdrop click, and returns focus to the previously focused element.
 */
export function Drawer({ open, onClose, title, children, widthClassName = "w-[28rem]" }: DrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusTo = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusTo.current = document.activeElement;
    panelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      (returnFocusTo.current as HTMLElement | null)?.focus?.();
    };
  }, [open, onClose]);

  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-shell/30 transition-opacity",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        inert={!open}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex max-w-full flex-col bg-white shadow-popover outline-none transition-transform ease-out-soft",
          widthClassName,
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 className="text-base font-semibold text-ink-900">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <Close />
          </IconButton>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </aside>
    </>
  );
}
