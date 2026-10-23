import type { ReactNode } from "react";
import { InfoTip } from "./InfoTip";
import { cn } from "./cn";

export interface Column<T> {
  key: string;
  header: string;
  /** Explanation opened from an info icon next to the column title. */
  info?: string;
  render: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right";
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
}

/** Bordered table with an uppercase header row, matching the builds list. */
export function DataTable<T>({ columns, rows, rowKey, empty }: DataTableProps<T>) {
  return (
    <div className="rounded-xl border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "px-6 py-4 text-[11px] font-semibold uppercase tracking-wider text-ink-500",
                  c.align === "right" && "text-right",
                  c.className,
                )}
              >
                <span className={cn("inline-flex items-center gap-1.5", c.align === "right" && "justify-end")}>
                  {c.header}
                  {c.info && <InfoTip title={c.header} align={c.align === "right" ? "right" : "left"}>{c.info}</InfoTip>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="align-top transition-colors hover:bg-page/60">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-6 py-5", c.align === "right" && "text-right", c.className)}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-ink-400">
                {empty ?? "Nothing to show."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
