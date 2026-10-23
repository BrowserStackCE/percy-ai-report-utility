import { useState } from "react";
import { Check, ChevronsUpDown, ChevronDown } from "./Icons";
import { Popover } from "./Popover";
import { cn } from "./cn";

export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Show a search box inside the menu (project switcher style). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Text shown in the trigger when no option is selected. */
  placeholder?: string;
  /** "field" is the bordered full-width selector; "compact" is the inline "All" style. */
  variant?: "field" | "compact";
  className?: string;
}

/** Single-select dropdown with a check on the active option and optional search. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  searchable = false,
  searchPlaceholder = "Search",
  placeholder,
  variant = "field",
  className,
}: SelectProps<T>) {
  const [query, setQuery] = useState("");
  const current = options.find((o) => o.value === value);
  const visible = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Popover
      panelClassName="w-full min-w-56 py-1.5"
      trigger={({ toggle, triggerProps }) => (
        <button
          type="button"
          aria-label={ariaLabel}
          onClick={toggle}
          {...triggerProps}
          className={cn(
            "flex w-full items-center justify-between gap-2 text-sm text-ink-900 transition-colors",
            variant === "field"
              ? "h-10 rounded-lg border border-line-strong bg-card px-3 hover:bg-surface"
              : "h-full px-4 font-medium hover:bg-surface",
            className,
          )}
        >
          <span className={cn("truncate", !current && "text-ink-400")}>{current?.label ?? placeholder ?? ""}</span>
          {variant === "field" ? <ChevronsUpDown size={16} className="text-ink-500" /> : <ChevronDown size={16} className="text-ink-500" />}
        </button>
      )}
    >
      {({ close }) => (
        <div>
          {searchable && (
            <div className="px-2 pb-1.5">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-9 w-full rounded-lg border border-brand-500 bg-card px-3 text-sm placeholder:text-ink-400 focus:outline-none"
              />
            </div>
          )}
          <ul role="listbox" aria-label={ariaLabel} className="max-h-64 overflow-auto">
            {visible.map((o) => (
              <li key={o.value} role="option" aria-selected={o.value === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setQuery("");
                    close();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface",
                    o.value === value ? "font-semibold text-ink-900" : "text-ink-700",
                  )}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-brand-500">
                    {o.value === value && <Check size={16} strokeWidth={2.5} />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              </li>
            ))}
            {visible.length === 0 && <li className="px-3 py-2 text-sm text-ink-400">No matches</li>}
          </ul>
        </div>
      )}
    </Popover>
  );
}
