import type { InputHTMLAttributes, ReactNode } from "react";
import { Check, Search } from "./Icons";
import { cn } from "./cn";

interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label: ReactNode;
  hint?: ReactNode;
  count?: number;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Checkbox row with optional hint and trailing count, as in the Filters panel. */
export function Checkbox({ label, hint, count, checked, onChange, disabled, className, ...rest }: ChoiceProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md px-1 py-1.5",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        {...rest}
      />
      <span
        aria-hidden="true"
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500",
          checked ? "border-brand-500 bg-brand-500 text-white" : "border-ink-300 bg-white",
        )}
      >
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
      <span className="flex-1">
        <span className="block text-sm text-ink-900">{label}</span>
        {hint && <span className="block text-xs text-ink-400">{hint}</span>}
      </span>
      {count !== undefined && <span className="text-sm tabular-nums text-ink-500">{count}</span>}
    </label>
  );
}

interface RadioProps {
  name: string;
  label: ReactNode;
  checked: boolean;
  onChange: () => void;
}

/** Radio row, as in the sort menu (Diff % / Bugs). */
export function Radio({ name, label, checked, onChange }: RadioProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 hover:bg-surface">
      <input type="radio" name={name} className="peer sr-only" checked={checked} onChange={onChange} />
      <span
        aria-hidden="true"
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-500",
          checked ? "border-brand-500" : "border-ink-300",
        )}
      >
        {checked && <span className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
      </span>
      <span className="text-sm font-medium text-ink-900">{label}</span>
    </label>
  );
}

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  /** Optional control rendered inside the right edge, such as an "All" dropdown. */
  trailing?: ReactNode;
}

export function SearchInput({ value, onChange, trailing, className, ...rest }: SearchInputProps) {
  return (
    <div className={cn("flex h-11 items-stretch overflow-hidden rounded-lg border border-line bg-white focus-within:border-brand-500", className)}>
      <span className="flex items-center pl-3 text-ink-500"><Search size={18} /></span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
        {...rest}
      />
      {trailing && <div className="flex items-center border-l border-line">{trailing}</div>}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function TextField({ label, value, onChange, id, className, ...rest }: TextFieldProps) {
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-ink-700">{label}</label>
      <input
        id={fieldId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-10 w-full rounded-lg border border-line-strong bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        {...rest}
      />
    </div>
  );
}
