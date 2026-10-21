import { cn } from "./cn";

interface HamburgerIconProps {
  /** When true the three bars morph into a close (X) shape. */
  open: boolean;
  className?: string;
}

const bar = "absolute left-0 h-0.5 w-full rounded-full bg-current transition-all";

/**
 * Animated menu icon. Only transform and opacity change, so it never shifts layout.
 * Shows the X when `open` is true.
 */
export function HamburgerIcon({ open, className }: HamburgerIconProps) {
  return (
    <span aria-hidden="true" className={cn("relative block h-4 w-5", className)}>
      <span className={cn(bar, "top-0", open && "translate-y-[7px] rotate-45")} />
      <span className={cn(bar, "top-[7px]", open && "scale-x-0 opacity-0")} />
      <span className={cn(bar, "top-[14px]", open && "-translate-y-[7px] -rotate-45")} />
    </span>
  );
}
