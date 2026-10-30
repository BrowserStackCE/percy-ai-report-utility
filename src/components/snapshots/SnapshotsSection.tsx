import { useMemo, useState } from "react";
import { Link } from "react-router";
import { isRetryable } from "../../api/errors";
import { useSnapshots } from "../../api/snapshots/useSnapshots";
import type { Snapshot, SnapshotAi, SnapshotComparison, SnapshotReviewState } from "../../api/snapshots/types";
import { count, humanize } from "../../lib/format";
import {
  Button,
  Card,
  Chip,
  DataTable,
  Drawer,
  External,
  LoadingOverlay,
  Pagination,
  Search,
  Select,
  StatusPill,
  TableSkeleton,
  buttonClass,
  type Column,
} from "../ui";

const reviewTone: Record<SnapshotReviewState, "mint" | "warn" | "danger" | "neutral"> = {
  approved: "mint",
  merged: "mint",
  unreviewed: "warn",
  changes_requested: "danger",
  rejected: "danger",
  unknown: "neutral",
};

/** Review-state reasons Percy accepts in filter[review-state-reason][]. */
const reasonOptions = [
  { value: "all", label: "All reasons" },
  { value: "unreviewed_comparisons", label: "Unreviewed comparisons" },
  { value: "no_diffs", label: "No diffs" },
  { value: "auto_approved_branch", label: "Auto-approved branch" },
  { value: "all_snapshots_approved", label: "Approved" },
  { value: "all_snapshots_approved_previously", label: "Approved previously" },
  { value: "changes_requested_snapshot", label: "Changes requested" },
  { value: "changes_requested_snapshot_previously", label: "Changes requested previously" },
  { value: "failed_snapshots", label: "Failed" },
  { value: "ignore_diff_setting", label: "Ignored by diff setting" },
  { value: "user_rejected", label: "Rejected by user" },
];

/** 0.0329 -> "3.29%". Percy sends a fraction; null stays a dash. */
export function formatRatio(ratio: number | null): string {
  if (ratio === null) return "—";
  const pct = ratio * 100;
  return `${pct >= 10 ? pct.toFixed(1) : pct.toFixed(2)}%`;
}

/** The comparison with the biggest AI (or raw) diff, which represents the snapshot in the list. */
function primaryComparison(s: Snapshot): SnapshotComparison | null {
  let best: SnapshotComparison | null = null;
  let bestScore = -1;
  for (const c of s.comparisons) {
    const score = c.aiDiffRatio ?? c.diffRatio ?? 0;
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}

function deviceLabel(c: SnapshotComparison): string {
  const d = c.device;
  const browser = d?.name ?? d?.browserName ?? null;
  const os = d?.osName ? `${d.osName}${d.osVersion ? ` ${d.osVersion}` : ""}` : null;
  const label = [browser ? humanize(browser) : null, os].filter(Boolean).join(" · ");
  return label || (c.width ? `${c.width}px` : "—");
}

function SnapshotRow({ s }: { s: Snapshot }) {
  const c = primaryComparison(s);
  return (
    <div className="flex items-start gap-3">
      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md border border-line bg-surface">
        {c?.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-ink-900" title={s.name}>
          {s.name}
        </p>
        {s.displayName && s.displayName !== s.name && <p className="mt-0.5 truncate text-xs text-ink-500">{s.displayName}</p>}
        {s.testCaseName && <p className="mt-0.5 truncate text-xs text-ink-500">{s.testCaseName}</p>}
        <div className="mt-1 flex flex-wrap gap-1.5">
          {s.isReintroduced && <Chip>Reintroduced</Chip>}
          {s.enableLayout && <Chip>Layout</Chip>}
          {s.enableJavascript && <Chip>JavaScript</Chip>}
          {s.layoutWarning && <Chip>Layout warning</Chip>}
        </div>
      </div>
    </div>
  );
}

/** The AI result worth showing for a snapshot: the first comparison where Percy AI ran, with the most findings. */
function aiOf(s: Snapshot): SnapshotAi | null {
  let best: SnapshotAi | null = null;
  for (const c of s.comparisons) {
    if (c.ai?.enabled && (!best || c.ai.findings.length > best.findings.length)) best = c.ai;
  }
  return best;
}

/** Full text of what Percy AI reported for one snapshot, shown in the right-hand drawer. */
function AiDetails({ s }: { s: Snapshot }) {
  const ai = aiOf(s);
  if (!ai) return <p className="text-sm text-ink-500">Percy AI did not run for this snapshot.</p>;
  const kept = ai.findings.filter((f) => !f.ignored);
  const ignored = ai.findings.filter((f) => f.ignored);
  const Finding = ({ f }: { f: SnapshotAi["findings"][number] }) => (
    <li className="rounded-lg border border-line p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-ink-900">{f.title ?? "Untitled change"}</p>
        {f.changeType && <Chip>{f.changeType}</Chip>}
      </div>
      {f.description && <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-700">{f.description}</p>}
      {f.reason && <p className="mt-1.5 whitespace-pre-wrap text-xs text-ink-500">{f.reason}</p>}
    </li>
  );
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-700">
        <span className="font-semibold tabular-nums">{count(ai.visualDiffs)}</span> visual diffs kept by Percy AI
        {ai.processingStatus ? ` · ${humanize(ai.processingStatus)}` : ""}
      </p>
      {ai.findings.length === 0 && ai.summary && <p className="whitespace-pre-wrap text-sm text-ink-700">{ai.summary}</p>}
      {kept.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Changes to review</h3>
          <ul className="space-y-2">{kept.map((f, i) => <Finding key={i} f={f} />)}</ul>
        </section>
      )}
      {ignored.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Ignored as noise</h3>
          <ul className="space-y-2">{ignored.map((f, i) => <Finding key={i} f={f} />)}</ul>
        </section>
      )}
    </div>
  );
}

const makeColumns = (openAi: (s: Snapshot) => void): Column<Snapshot>[] => [
  { key: "snapshot", header: "Snapshot", className: "max-w-sm", render: (s) => <SnapshotRow s={s} /> },
  {
    key: "review",
    header: "Review",
    info: "Whether the snapshot has been approved, rejected or still waits for a reviewer, and the reason Percy gives.",
    render: (s) => (
      <div className="flex flex-col items-start gap-1">
        <StatusPill tone={reviewTone[s.reviewState]}>{humanize(s.reviewState)}</StatusPill>
        {s.reviewStateReason && <span className="text-xs text-ink-500">{humanize(s.reviewStateReason)}</span>}
      </div>
    ),
  },
  {
    key: "diff",
    header: "Diff",
    info: "The share of the page that changed. With Percy AI, the AI figure is the change left after noise was filtered out.",
    render: (s) => {
      const c = primaryComparison(s);
      if (!c) return <span className="text-ink-400">—</span>;
      return (
        <div className="text-sm tabular-nums text-ink-900">
          {formatRatio(c.aiDiffRatio ?? c.diffRatio)}
          {c.aiDiffRatio !== null && <p className="mt-0.5 text-xs text-ink-500">After AI filtering</p>}
        </div>
      );
    },
  },
  {
    key: "ai",
    header: "Percy AI",
    info: "What the Percy AI Review Agent found for this snapshot: visual diffs it kept and a short summary.",
    className: "max-w-xs",
    render: (s) => {
      const ai = aiOf(s);
      if (!ai) return <span className="text-sm text-ink-400">Not run</span>;
      return (
        <button
          type="button"
          onClick={() => openAi(s)}
          aria-label={`Open Percy AI details for ${s.name}`}
          className="group inline-flex items-center gap-1.5 rounded-md text-sm text-ink-900 hover:text-brand-600"
        >
          <span className="tabular-nums">{count(ai.visualDiffs)} visual diffs</span>
          <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">›</span>
        </button>
      );
    },
  },
  {
    key: "comparisons",
    header: "Comparisons",
    info: "One comparison per browser and width this snapshot was rendered in.",
    render: (s) => (
      <div className="flex flex-col gap-0.5 text-sm text-ink-700">
        <span className="tabular-nums">{count(s.comparisons.length)}</span>
        {s.comparisons[0] && <span className="max-w-48 truncate text-xs text-ink-500">{deviceLabel(s.comparisons[0])}</span>}
      </div>
    ),
  },
  {
    key: "comments",
    header: "Comments",
    align: "right",
    render: (s) => <span className="tabular-nums text-ink-700">{count(s.openComments)}</span>,
  },
];

/** Searchable, filterable, paged list of one build's snapshots. */
export function SnapshotsSection({ buildId, percyUrl }: { buildId: string; percyUrl?: string | null }) {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const [reason, setReason] = useState("all");

  const filters = useMemo(
    () => ({ search: applied || undefined, reviewStateReasons: reason === "all" ? undefined : [reason] }),
    [applied, reason],
  );
  const { status, snapshots, error, page, hasNext, hasPrev, loadingPage, next, prev, reload } = useSnapshots(buildId, filters);
  const filtered = applied !== "" || reason !== "all";
  const [aiFor, setAiFor] = useState<Snapshot | null>(null);
  const columns = useMemo(() => makeColumns(setAiFor), []);

  return (
    <section aria-labelledby="snapshots-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="snapshots-heading" className="text-lg font-semibold text-ink-900">
          Snapshots
        </h2>
        {percyUrl && (
          <a href={percyUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
            <External size={16} />
            Review in Percy
          </a>
        )}
      </div>

      {error ? (
        <Card className="p-5">
          <p role="alert" className="text-sm font-medium text-danger-600">{error.message}</p>
          {error.hint && <p className="mt-1 text-sm text-ink-500">{error.hint}</p>}
          <div className="mt-3 flex gap-2">
            {error.kind === "not_authenticated" || error.kind === "unauthorized" ? (
              <Link to="/login" className={buttonClass("primary")}>Sign in</Link>
            ) : (
              isRetryable(error) && <Button onClick={reload}>Try again</Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          <form
            role="search"
            aria-label="Filter snapshots"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(query.trim());
            }}
            className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-card p-4"
          >
            <label className="relative min-w-64 flex-1">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">Name</span>
              <span className="pointer-events-none absolute bottom-0 left-3 flex h-10 items-center text-ink-500">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search snapshots by name"
                className="h-10 w-full rounded-lg border border-line-strong bg-card pl-9 pr-9 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    setApplied("");
                  }}
                  className="absolute bottom-0 right-1.5 flex h-10 w-7 items-center justify-center text-lg text-ink-400 hover:text-ink-900"
                >
                  ×
                </button>
              )}
            </label>
            <div className="w-60">
              <span className="mb-1.5 block text-sm font-medium text-ink-700">Review reason</span>
              <Select value={reason} options={reasonOptions} onChange={setReason} ariaLabel="Review state reason" />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" className="h-10">
                Apply
              </Button>
              {filtered && (
                <Button
                  className="h-10"
                  onClick={() => {
                    setQuery("");
                    setApplied("");
                    setReason("all");
                  }}
                >
                  Reset
                </Button>
              )}
            </div>
          </form>

          {status === "loading" && snapshots.length === 0 ? (
            <LoadingOverlay label="Loading snapshots">
              <TableSkeleton rows={5} cols={5} />
            </LoadingOverlay>
          ) : (
            <div className="fade-in space-y-4">
              <div className={loadingPage ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={loadingPage}>
                <div className="space-y-3 md:hidden">
                  {snapshots.map((s) => {
                    const c = primaryComparison(s);
                    return (
                      <Card key={s.id} className="p-3">
                        <SnapshotRow s={s} />
                        <div className="mt-3 grid grid-cols-3 gap-3 border-t border-line pt-3">
                          <div><span className="block text-xs text-ink-500">Review</span><StatusPill tone={reviewTone[s.reviewState]}>{humanize(s.reviewState)}</StatusPill></div>
                          <div><span className="block text-xs text-ink-500">Diff</span><span className="text-sm font-semibold text-ink-900">{c ? formatRatio(c.aiDiffRatio ?? c.diffRatio) : "—"}</span></div>
                          <div><span className="block text-xs text-ink-500">Comments</span><span className="text-sm font-semibold text-ink-900">{count(s.openComments)}</span></div>
                        </div>
                      </Card>
                    );
                  })}
                  {snapshots.length === 0 && <Card className="p-8 text-center text-sm text-ink-500">{filtered ? "No snapshots match these filters." : "This build has no snapshots."}</Card>}
                </div>
                <div className="hidden md:block">
                  <DataTable
                    columns={columns}
                    rows={snapshots}
                    rowKey={(s) => s.id}
                    empty={filtered ? "No snapshots match these filters." : "This build has no snapshots."}
                  />
                </div>
              </div>
              <Pagination
                page={page}
                hasPrev={hasPrev}
                hasNext={hasNext}
                onPrev={prev}
                onNext={next}
                busy={loadingPage}
                summary={`${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"} on this page`}
              />
            </div>
          )}
        </>
      )}
      <Drawer open={aiFor !== null} onClose={() => setAiFor(null)} title={aiFor ? `Percy AI · ${aiFor.name}` : "Percy AI"} widthClassName="w-[32rem]">
        {aiFor && <AiDetails s={aiFor} />}
      </Drawer>
    </section>
  );
}
