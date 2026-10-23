import { Button } from "./Button";

interface PaginationProps {
  /** 1-based current page. */
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  /** Short text such as "21–40 of 87". */
  summary?: string;
  busy?: boolean;
}

/** Previous / next pager with an optional range summary. */
export function Pagination({ page, hasPrev, hasNext, onPrev, onNext, summary, busy }: PaginationProps) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3">
      <p role="status" className="text-sm text-ink-500">
        {summary ?? `Page ${page}`}
      </p>
      <div className="flex items-center gap-2">
        <Button onClick={onPrev} disabled={!hasPrev || busy}>
          Previous
        </Button>
        <span className="min-w-16 text-center text-sm tabular-nums text-ink-700">Page {page}</span>
        <Button onClick={onNext} disabled={!hasNext || busy}>
          Next
        </Button>
      </div>
    </nav>
  );
}
