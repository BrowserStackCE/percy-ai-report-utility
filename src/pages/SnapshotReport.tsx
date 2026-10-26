import { Link, useParams } from "react-router";
import { isRetryable } from "../api/errors";
import { useBuild } from "../api/builds/useBuild";
import { useSnapshot } from "../api/snapshots/useSnapshot";
import { percySnapshotUrl, rankComparisons, snapshotMetrics, type ComparisonSeverity } from "../api/snapshots/report";
import type { Snapshot, SnapshotComparison, SnapshotReviewState } from "../api/snapshots/types";
import { REVIEW_LABELS } from "../api/snapshots/aggregate";
import { formatRatio } from "../components/snapshots/SnapshotsSection";
import { count, humanize } from "../lib/format";
import {
  ArrowLeft,
  Button,
  Card,
  CardSkeleton,
  Chip,
  DataTable,
  External,
  LoadingOverlay,
  PageContainer,
  PageHeader,
  Skeleton,
  SkeletonLines,
  StackedBar,
  StatCard,
  StatusPill,
  Widget,
  buttonClass,
  type Column,
  type Segment,
} from "../components/ui";

const reviewTone: Record<SnapshotReviewState, "mint" | "warn" | "danger" | "neutral"> = {
  approved: "mint",
  merged: "mint",
  unreviewed: "warn",
  changes_requested: "danger",
  rejected: "danger",
  unknown: "neutral",
};

const severityTone: Record<ComparisonSeverity, "mint" | "warn" | "danger" | "neutral"> = {
  none: "mint",
  minor: "neutral",
  moderate: "warn",
  major: "danger",
};

const severityLabel: Record<ComparisonSeverity, string> = {
  none: "No change",
  minor: "Under 1%",
  moderate: "1% to 10%",
  major: "Over 10%",
};

function deviceLabel(c: SnapshotComparison): string {
  const d = c.device;
  const browser = d?.name ?? d?.browserName ?? null;
  const os = d?.osName ? `${d.osName}${d.osVersion ? ` ${d.osVersion}` : ""}` : null;
  return [browser ? humanize(browser) : null, os].filter(Boolean).join(" · ") || "Unknown device";
}

function SnapshotSkeleton() {
  return (
    <PageContainer>
      <LoadingOverlay label="Loading snapshot" className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <CardSkeleton>
          <SkeletonLines lines={6} />
        </CardSkeleton>
      </LoadingOverlay>
    </PageContainer>
  );
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <>
      <dt className="font-semibold text-ink-700">{label}</dt>
      <dd className="min-w-0 break-words text-ink-900">{value}</dd>
    </>
  );
}

function ComparisonsTable({ snapshot }: { snapshot: Snapshot }) {
  const ranked = rankComparisons(snapshot);
  const columns: Column<(typeof ranked)[number]>[] = [
    {
      key: "device",
      header: "Browser / device",
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-ink-900">{deviceLabel(r.comparison)}</p>
          <p className="text-xs text-ink-500">{r.comparison.width ? `${r.comparison.width}px wide` : "Width not reported"}</p>
        </div>
      ),
    },
    {
      key: "diff",
      header: "Diff",
      info: "The share of the page that changed. With Percy AI this is the share left after noise was filtered out.",
      render: (r) => (
        <div className="flex flex-col items-start gap-1">
          <span className="font-semibold tabular-nums text-ink-900">{formatRatio(r.ratio)}</span>
          <StatusPill tone={severityTone[r.severity]}>{severityLabel[r.severity]}</StatusPill>
        </div>
      ),
    },
    {
      key: "noise",
      header: "Noise removed",
      info: "How much of the raw diff Percy AI judged to be noise. Shown only when Percy reported both the raw and the AI figure.",
      render: (r) =>
        r.noiseRemoved === null ? (
          <span className="text-ink-400">—</span>
        ) : (
          <span className="tabular-nums text-ink-700">{formatRatio(r.noiseRemoved)}</span>
        ),
    },
    {
      key: "ai",
      header: "Percy AI",
      className: "max-w-xs",
      render: (r) => {
        const c = r.comparison;
        if (!c.ai?.enabled) return <span className="text-sm text-ink-400">Not run</span>;
        return (
          <div className="text-sm">
            <p className="tabular-nums text-ink-900">{count(c.ai.visualDiffs)} visual diffs</p>
            {c.ai.summary && <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{c.ai.summary}</p>}
            {r.aiProblem && <p className="mt-0.5 text-xs font-medium text-red-600">{humanize(r.aiProblem)}</p>}
          </div>
        );
      },
    },
    {
      key: "recurring",
      header: "Recurring diff",
      info: "Whether Percy has seen this same change on earlier builds.",
      render: (r) => <span className="text-sm text-ink-700">{r.comparison.recurringDiffStatus ? humanize(r.comparison.recurringDiffStatus) : "—"}</span>,
    },
    {
      key: "session",
      header: "Session",
      align: "right",
      render: (r) =>
        r.comparison.externalDebugUrl ? (
          <a href={r.comparison.externalDebugUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:underline">
            Debug <External size={14} />
          </a>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
  ];
  return <DataTable columns={columns} rows={ranked} rowKey={(r) => r.comparison.id} empty="Percy returned no comparisons for this snapshot." />;
}

/** Snapshot-level report: metrics for one snapshot, with a way to jump into Percy to act on it. */
export default function SnapshotReport() {
  const { buildId = "", snapshotId = "" } = useParams();
  const { status, snapshot, error, reload } = useSnapshot(snapshotId);
  const { build } = useBuild(buildId);
  const backTo = `/reports/${buildId}`;

  if (status === "loading") return <SnapshotSkeleton />;

  if (error || !snapshot) {
    return (
      <PageContainer>
        <PageHeader title="Snapshot" backTo={backTo} />
        <Card className="p-5">
          <p role="alert" className="text-sm font-medium text-red-600">{error?.message ?? "Snapshot not found."}</p>
          {error?.hint && <p className="mt-1 text-sm text-ink-500">{error.hint}</p>}
          <div className="mt-3 flex gap-2">
            {error && (error.kind === "not_authenticated" || error.kind === "unauthorized") ? (
              <Link to="/login" className={buttonClass("primary")}>Sign in</Link>
            ) : (
              error && isRetryable(error) && <Button onClick={reload}>Try again</Button>
            )}
            <Link to={backTo} className={buttonClass("secondary")}>Back to build</Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const s = snapshot;
  const m = snapshotMetrics(s);
  const percyUrl = percySnapshotUrl(build?.percyUrl ?? null, s.id);
  const title = s.displayName ?? s.name;
  // The snapshot must belong to the build in the URL; otherwise the breadcrumb and links would mislead.
  const wrongBuild = s.buildId !== null && buildId !== "" && s.buildId !== buildId;
  const severitySegments: Segment[] = [
    { key: "none", label: "No change", value: m.bySeverity.none, color: "bg-mint-500" },
    { key: "minor", label: "Under 1%", value: m.bySeverity.minor, color: "bg-amber-300" },
    { key: "moderate", label: "1% to 10%", value: m.bySeverity.moderate, color: "bg-amber-500" },
    { key: "major", label: "Over 10%", value: m.bySeverity.major, color: "bg-red-500" },
  ];
  const flags = [
    s.isReintroduced && "Reintroduced",
    s.enableLayout && "Layout testing",
    s.enableJavascript && "JavaScript enabled",
    s.layoutWarning && "Layout warning",
  ].filter((f): f is string => Boolean(f));

  return (
    <PageContainer>
      <div className="flex items-start gap-3">
        <Link
          to={backTo}
          aria-label="Back to build"
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-900 transition-colors hover:bg-chip"
        >
          <ArrowLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <PageHeader
            title={<span className="break-words">{title}</span>}
            meta={
              <>
                <StatusPill tone={reviewTone[s.reviewState]}>{REVIEW_LABELS[s.reviewState]}</StatusPill>
                {s.reviewStateReason && <Chip>{humanize(s.reviewStateReason)}</Chip>}
              </>
            }
            description={s.testCaseName ?? undefined}
            actions={
              percyUrl ? (
                <a href={percyUrl} target="_blank" rel="noreferrer" className={buttonClass("primary")}>
                  <External size={16} />
                  Review in Percy
                </a>
              ) : undefined
            }
          />
        </div>
      </div>

      {wrongBuild && (
        <Card className="border-amber-300 p-4">
          <p role="alert" className="text-sm text-ink-900">
            This snapshot belongs to build {s.buildId}, not build {buildId}.{" "}
            <Link to={`/reports/${s.buildId}/snapshots/${s.id}`} className="text-brand-600 hover:underline">Open it under its own build</Link>
          </p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Comparisons changed"
          value={`${count(m.changed)} of ${count(m.comparisons)}`}
          hint={`${count(m.unchanged)} unchanged`}
          info="Browser and width renders of this snapshot that differ from the base build. When Percy AI ran, noise it filtered out is not counted."
        />
        <StatCard
          label="Largest change"
          value={formatRatio(m.maxRatio)}
          hint={m.averageRatio !== null ? `${formatRatio(m.averageRatio)} on average` : "Nothing changed"}
          info="The biggest share of the page that changed in any one comparison, and the average across the comparisons that changed."
        />
        <StatCard
          label="AI noise removed"
          value={formatRatio(m.averageNoiseRemoved)}
          hint={m.aiAnalysed > 0 ? `${count(m.aiVisualDiffs)} visual diffs kept` : "Percy AI did not run"}
          info="The average gap between the raw diff and the diff left after Percy AI filtered noise, over comparisons that report both."
        />
        <StatCard
          label="Open comments"
          value={count(s.openComments)}
          hint={m.aiProblems > 0 ? `${count(m.aiProblems)} AI problems` : "No AI problems"}
          info="Unresolved review comments on this snapshot, and comparisons where Percy AI failed or did not finish."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title="Where the changes are" info="Comparisons grouped by how much of the page changed.">
          <StackedBar segments={severitySegments} />
          <ul className="mt-4 space-y-2 text-sm">
            {severitySegments.map((seg) => (
              <li key={seg.key} className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${seg.color}`} />
                <span className="flex-1 text-ink-700">{seg.label}</span>
                <span className="tabular-nums text-ink-900">{count(seg.value)}</span>
              </li>
            ))}
          </ul>
        </Widget>

        <Widget title="Snapshot settings" info="How this snapshot was captured. These explain differences that are not caused by your change.">
          <dl className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
            <Fact label="Snapshot ID" value={s.id} />
            <Fact label="Test case" value={s.testCaseName ? `${s.testCaseName}${s.testCaseId ? ` (#${s.testCaseId})` : ""}` : s.testCaseId} />
            <Fact label="Scope selector" value={s.scopeSelector} />
            <Fact label="Fingerprint" value={s.fingerprint} />
            <Fact label="Layout warning" value={s.layoutWarning} />
          </dl>
          {flags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {flags.map((f) => (
                <Chip key={f}>{f}</Chip>
              ))}
            </div>
          )}
        </Widget>
      </div>

      <section aria-labelledby="comparisons-heading" className="space-y-3">
        <h2 id="comparisons-heading" className="text-lg font-semibold text-ink-900">
          Comparisons
        </h2>
        <ComparisonsTable snapshot={s} />
      </section>
    </PageContainer>
  );
}