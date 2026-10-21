import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 border border-transparent",
  secondary: "bg-white text-ink-900 border border-line-strong hover:bg-surface",
  ghost: "bg-transparent text-ink-700 border border-transparent hover:bg-chip",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  leadingIcon?: ReactNode;
}

const buttonBase =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** Class string for anchors/links that should look like a Button. */
export function buttonClass(variant: Variant = "secondary", extra?: string) {
  return cn(buttonBase, variants[variant], extra);
}

export function Button({ variant = "secondary", leadingIcon, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={buttonClass(variant, className)} {...rest}>
      {leadingIcon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
}

/** Square icon-only button. `label` is required for accessibility. */
export function IconButton({ label, active, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-lg border text-ink-700 transition-colors",
        active ? "border-brand-500 bg-brand-50 text-brand-600" : "border-transparent hover:bg-chip",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
