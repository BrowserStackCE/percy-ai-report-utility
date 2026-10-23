import type { ReactNode } from "react";
import { Info } from "./Icons";
import { Popover } from "./Popover";

interface InfoTipProps {
  /** Short heading shown at the top of the popover, usually the card title. */
  title: string;
  /** Explanation shown after clicking the icon. */
  children: ReactNode;
  align?: "left" | "right";
}

/** Small (i) button that opens a popover explaining a card. Works with mouse, touch and keyboard. */
export function InfoTip({ title, children, align = "left" }: InfoTipProps) {
  return (
    <Popover
      align={align}
      panelClassName="w-72 p-4"
      trigger={({ toggle, triggerProps }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={`About ${title}`}
          className="flex h-5 w-5 items-center justify-center rounded-full text-ink-400 transition-colors hover:bg-chip hover:text-ink-900"
          {...triggerProps}
        >
          <Info size={14} />
        </button>
      )}
    >
      {() => (
        <div className="text-left">
          <p className="text-sm font-semibold text-ink-900">{title}</p>
          <div className="mt-1.5 text-sm leading-relaxed text-ink-700">{children}</div>
        </div>
      )}
    </Popover>
  );
}
