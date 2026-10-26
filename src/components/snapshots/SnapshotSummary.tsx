import type { ReactNode } from "react";
import { Link } from "react-router";
import type { AllSnapshotsState } from "../../api/snapshots/useAllSnapshots";
import {
  REVIEW_LABELS,
  aggregateSnapshots,
  type CountRow,
  type DiffBucket,
  type SnapshotAggregate,
} from "../../api/snapshots/aggregate";
import type { SnapshotReviewState } from "../../api/snapshots/types";
import { count } from "../../lib/format";
import { Button, Card, CardSkeleton, Skeleton, StackedBar, StatCard, StatusPill, Widget, buttonClass, type Segment } from "../ui";
import { useMemo } from "react";
import { formatRatio } from "./SnapshotsSection";

const reviewColor: Record<SnapshotReviewState, string> = {
  approved: "bg-mint-500",
  merged: "bg-mint-300",
  unreviewed: "bg-amber-400",
  changes_requested: "bg-red-500",
  rejected: "bg-red-700",
  unknown: "bg-ink-300",
};

const reviewTone: Record<SnapshotReviewState, "mint" | "warn" | "danger" | "neutral"> = {
  approved: "mint",
  merged: "mint",
  unreviewed: "warn",
  changes_requested: "danger",
  rejected: "danger",
  unknown: "neutral",
};

const bucketColor: Record<DiffBucket["key"], string> = {
  none: "bg-mint-500",
  minor: "bg-amber-300",
  moderate: "bg-amber-500",
  major: "bg-red-500",
};

/** Percentage of a whole, safe for a zero total. */
const share = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : "—");

/** Horizontal bar rows: label, proportional bar, count and share. Used for browsers, systems and widths. */
function BarRows({ rows, total, empty }: { rows: CountRow[]; total: number; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-ink-400">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-3">
      {rows.slice(0, 6).map((r) => (
        <li key={r.key} className="text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-ink-700">{r.label}</span>
            <span className="shrink-0 tabular-nums text-ink-900">
              {count(r.count)} <span className="text-xs text-ink-400">{share(r.count, total)}</span>
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-chip">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Legend({ segments }: { segments: Segment[] }) {
  return (
    <ul className="mt-4 space-y-2 text-sm">
      {segments.map((s) => (
        <li key={s.key} className="flex items-center gap-3">
          <span className={`h-2 w-2 rounded-full ${s.color}`} />
          <span className="flex-1 text-ink-700">{s.label}</span>
          <span className="tabular-nums text-ink-900">{count(s.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function KpiGrid({ a, total }: { a: SnapshotAggregate; total: number | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Snapshots analysed"
        value={count(a.snapshots)}
        hint={total !== null && total !== a.snapshots ? `of ${count(total)} in the build` : `${count(a.comparisons)} comparisons`}
        info="Snapshots counted in this report. Each one is rendered in every browser and width, and those renders are the comparisons."
      />
      <StatCard
        label="With visual changes"
        value={count(a.snapshotsWithDiffs)}
        hint={`${share(a.snapshotsWithDiffs, a.snapshots)} of snapshots · ${count(a.snapshotsWithoutDiffs)} unchanged`}
        info="Snapshots where at least one comparison differs from the base build. When Percy AI ran, noise it filtered out is not counted."
      />
      <StatCard
        label="Average change"
        value={formatRatio(a.averageDiffRatio)}
        hint={a.maxDiffRatio !== null ? `Largest ${formatRatio(a.maxDiffRatio)}` : "Nothing changed"}
        info="Mean share of the page that changed, across snapshots that changed at all. The largest single change is shown below it."
      />
      <StatCard
        label="Percy AI visual diffs"
        value={a.ai.analysed > 0 ? count(a.ai.visualDiffs) : "—"}
        hint={
          a.ai.analysed > 0
            ? `${count(a.ai.analysed)} comparisons analysed${a.ai.averageNoiseRemoved !== null ? ` · ${formatRatio(a.ai.averageNoiseRemoved)} noise removed` : ""}`
            : "Percy AI did not run"
        }
        info="Visual diffs the Percy AI Review Agent kept after filtering. Noise removed is how much smaller the diff became once AI ignored insignificant changes."
      />
    </div>
  );
}

/** Cumulative report for a whole build, derived from every snapshot Percy returned. */
export function SnapshotSummary({
  state,
  buildTotal,
  buildId,
}: {
  state: AllSnapshotsState;
  buildTotal: number | null;
  buildId: string;
}) {
  const { snapshots, status, error, pagesLoaded, truncated, reload } = state;
  const a = useMemo(() => aggregateSnapshots(snapshots), [snapshots]);

  if (error) {
    return (
      <Card className="p-5">
        <p role="alert" className="text-sm font-medium text-red-600">{error.message}</p>
        {error.hint && <p className="mt-1 text-sm text-ink-500">{error.hint}</p>}
        <div className="mt-3 flex gap-2">
          {error.kind === "not_authenticated" || error.kind === "unauthorized" ? (
            <Link to="/login" className={buttonClass("primary")}>Sign in</Link>
          ) : (
            <Button onClick={reload}>Try again</Button>
          )}
        </div>
      </Card>
    );
  }

  if (status === "loading" && snapshots.length === 0) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading report">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i}>
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-5 h-24 w-full" />
            </CardSkeleton>
          ))}
        </div>
      </div>
    );
  }

  if (a.snapshots === 0) {
    return (
      <Card className="p-5">
        <p className="text-sm text-ink-500">This build has no snapshots to report on.</p>
      </Card>
    );
  }

  const reviewSegments: Segment[] = a.review.map((r) => ({
    key: r.key,
    label: r.label,
    value: r.count,
    color: reviewColor[r.key as SnapshotReviewState] ?? "bg-ink-300",
  }));
  const diffSegments: Segment[] = a.diffBuckets.map((b) => ({
    key: b.key,
    label: b.label,
    value: b.count,
    color: bucketColor[b.key],
  }));
  const loadingMore = status === "loading";

  return (
    <div className="fade-in space-y-4">
      {(loadingMore || truncated) && (
        <p role="status" className="text-xs text-ink-500">
          {loadingMore
            ? `Still loading: ${count(a.snapshots)} snapshots so far (${pagesLoaded} pages). Totals update as pages arrive.`
            : `Report covers the first ${count(a.snapshots)} snapshots of this build. Open the build in Percy for the rest.`}
        </p>
      )}

      <KpiGrid a={a} total={buildTotal} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="Review status" info="How far review has got across the snapshots in this report.">
          <StackedBar segments={reviewSegments} />
          <Legend segments={reviewSegments} />
          {a.reviewReasons.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">Why Percy set this state</p>
              <ul className="space-y-1.5 text-sm">
                {a.reviewReasons.slice(0, 5).map((r) => (
                  <li key={r.key} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-ink-700">{r.label}</span>
                    <span className="tabular-nums text-ink-900">{count(r.count)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Widget>

        <Widget title="Change distribution" info="Snapshots grouped by how much of the page changed, using the biggest comparison of each snapshot.">
          <StackedBar segments={diffSegments} />
          <Legend segments={diffSegments} />
          <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
            <div>
              <p className="text-xs text-ink-500">Open comments</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">{count(a.openComments)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Reintroduced</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">{count(a.reintroduced)}</p>
            </div>
            <div>
              <p className="text-xs text-ink-500">Linked test cases</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-ink-900">{count(a.withTestCase)}</p>
            </div>
          </div>
        </Widget>

        <Widget title="Coverage by browser" info="How many comparisons ran in each browser.">
          <BarRows rows={a.browsers} total={a.comparisons} empty="Percy returned no browser data for these comparisons." />
        </Widget>

        <Widget title="Coverage by width" info="How many comparisons ran at each viewport width.">
          <BarRows rows={a.widths} total={a.comparisons} empty="Percy returned no width data for these comparisons." />
        </Widget>

        {a.operatingSystems.length > 0 && (
          <Widget title="Coverage by operating system" info="How many comparisons ran on each operating system.">
            <BarRows rows={a.operatingSystems} total={a.comparisons} empty="No operating system data." />
          </Widget>
        )}

        <Widget
          title="Biggest changes"
          info="The snapshots whose pages changed the most. Open one in Percy to review the diff."
          className={a.operatingSystems.length > 0 ? "" : "lg:col-span-1"}
        >
          {a.topDiffs.length === 0 ? (
            <p className="text-sm text-ink-400">No snapshot changed in this build.</p>
          ) : (
            <ol className="space-y-3">
              {a.topDiffs.map((t, i) => (
                <li key={t.snapshotId} className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-xs tabular-nums text-ink-400">{i + 1}</span>
                  <div className="h-10 w-14 shrink-0 overflow-hidden rounded-md border border-line bg-surface">
                    {t.imageUrl && <img src={t.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover object-top" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900" title={t.name}>
                      <Link
                        to={`/reports/${buildId}/snapshots/${t.snapshotId}`}
                        className="hover:text-brand-600 hover:underline"
                        aria-label={`Open the report for ${t.name}`}
                      >
                        {t.name}
                      </Link>
                    </p>
                    {t.device && <p className="truncate text-xs text-ink-500">{t.device}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-semibold tabular-nums text-ink-900">{formatRatio(t.ratio)}</span>
                    <StatusPill tone={reviewTone[t.reviewState]}>{REVIEW_LABELS[t.reviewState]}</StatusPill>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Widget>
      </div>
      <span className="sr-only">Report for build {buildId}</span>
    </div>
  );
}

export type { ReactNode };
