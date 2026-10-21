import { cn } from "./cn";

interface TruncateProps {
  children: string;
  className?: string;
}

/**
 * Single-line text that ends in an ellipsis when it does not fit, with the full text in a
 * tooltip. The parent must be allowed to shrink (a flex item needs `min-w-0`) or have a width.
 */
export function Truncate({ children, className }: TruncateProps) {
  return (
    <span title={children} className={cn("block min-w-0 truncate", className)}>
      {children}
    </span>
  );
}
