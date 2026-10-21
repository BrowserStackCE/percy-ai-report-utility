import type { ReactNode } from "react";
import { Link } from "react-router";
import { ArrowLeft } from "./Icons";

interface PageHeaderProps {
  title: ReactNode;
  /** When set, shows a back arrow linking here (build-header style). */
  backTo?: string;
  /** Pill or chips shown beside the title. */
  meta?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, backTo, meta, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          {backTo && (
            <Link
              to={backTo}
              aria-label="Back"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-900 transition-colors hover:bg-chip"
            >
              <ArrowLeft size={22} />
            </Link>
          )}
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {meta}
        </div>
        {description && <p className="mt-2 max-w-2xl text-sm text-ink-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
