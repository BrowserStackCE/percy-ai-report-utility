import { useEffect, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { isRetryable } from "../api/errors";
import { useBuild } from "../api/builds/useBuild";
import type { Build } from "../api/builds/types";
import { count, formatDuration, humanize, shortSha } from "../lib/format";
import { useDateFormat } from "../lib/dateFormat";
import { SnapshotsSection } from "../components/snapshots/SnapshotsSection";
import { SnapshotSummary } from "../components/snapshots/SnapshotSummary";
import { ReportHeader } from "../components/report/ReportHeader";
import { useAllSnapshots } from "../api/snapshots/useAllSnapshots";
import {
  ArrowLeft,
  Button,
  Card,
  CardSkeleton,
  Chip,
  LoadingOverlay,
  PageContainer,
  PageHeader,
  Skeleton,
  SkeletonLines,
  StackedBar,
  StatCard,
  StatusPill,
  TabBar,
  Widget,
  buttonClass,
  type Segment,
} from "../components/ui";

type ReportTab = "overview" | "snapshots" | "details";

type Row = [string, ReactNode];

/** True when Percy sent nothing for the field: null, undefined, an empty string or the "—" placeholder. */
const isMissing = (v: ReactNode) => v === null || v === undefined || v === "" || v === "—";

/** A yes/no answer shown as a pill so it reads at a glance. Create one with `yesNo`. */
function YesNoPill({ value }: { value: boolean }) {
  return <StatusPill tone={value ? "mint" : "neutral"}>{value ? "Yes" : "No"}</StatusPill>;
}

const yesNo = (v: boolean): ReactNode => <YesNoPill value={v} />;

/** A group of label / value rows, named after the widget it appears in. */
interface FactGroup {
  title: string;
  rows: Row[];
}

/**
 * Label / value rows used inside the detail widgets. Only the rows Percy actually returned are shown,
 * with the label in bold. The rest are listed once at the end of the tab by <NotReturnedCard>, so a
 * gap is never mistaken for a real value.
 */
function Facts({ rows }: { rows: Row[] }) {
  const present = rows.filter(([, v]) => !isMissing(v));
  if (present.length === 0) return <p className="text-sm text-ink-400">Nothing returned for this section.</p>;
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 text-sm sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:items-center">
      {present.map(([label, value]) => (
        <div key={label} className="grid gap-0.5 border-b border-line pb-2 last:border-b-0 last:pb-0 sm:contents sm:border-0">
          <dt className="font-semibold text-ink-700">{label}</dt>
          <dd className="min-w-0 break-words text-ink-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The closing card of a tab: every field Percy did not return, grouped by the widget it belongs to. */
function NotReturnedCard({ groups }: { groups: FactGroup[] }) {
  const missing = groups
    .map((g) => ({ title: g.title, rows: g.rows.filter(([, v]) => isMissing(v)) }))
    .filter((g) => g.rows.length > 0);
  if (missing.length === 0) return null;
  return (
    <Widget
      title="Fields Percy did not return"
      info="Fields this page can show but that Percy sent empty for this build. They are collected here at the end so they are not mistaken for real values."
    >
      <div className="space-y-4">
        {missing.map((g) => (
          <div key={g.title}>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-500">{g.title}</p>
            <ul className="flex flex-wrap gap-1.5">
              {g.rows.map(([label]) => (
                <li key={label}>
                  <Chip>{label}</Chip>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Widget>
  );
}

function ExternalLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
      {children}
    </a>
  );
}

/** Delay before a tab's content mounts, so switching always shows the shimmer and then fades in. */
const TAB_SHIMMER_MS = 450;

/** Shimmer shown in a tab while its content is being prepared. */
function TabSkeleton({ label }: { label: string }) {
  return (
    <LoadingOverlay label={label} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i}>
            <Skeleton className="h-4 w-32" />
            <SkeletonLines lines={4} className="mt-5" />
          </CardSkeleton>
        ))}
      </div>
    </LoadingOverlay>
  );
}

/**
 * Mounts a tab's content only after the tab has been opened, behind a short shimmer, and keeps it
 * mounted afterwards so going back to a visited tab is instant and loses no state.
 */
function LazyTab({
  id,
  active,
  label,
  children,
  className,
}: {
  id: ReportTab;
  active: boolean;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!active || ready) return;
    const t = window.setTimeout(() => setReady(true), TAB_SHIMMER_MS);
    return () => window.clearTimeout(t);
  }, [active, ready]);

  // Never opened: render nothing, so the tab does no work (and fetches nothing) until it is chosen.
  if (!active && !ready) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!active}
      className={ready ? `tab-enter ${className ?? ""}` : undefined}
    >
      {ready ? children : <TabSkeleton label={label} />}
    </div>
  );
}

/** Placeholder with the same layout as the loaded page, so nothing jumps when data arrives. */
function DetailsSkeleton() {
  return (
    <PageContainer>
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <LoadingOverlay label="Loading build" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid">
          {Array.from({ length: 6 }, (_, i) => (
            <CardSkeleton key={i}>
              <Skeleton className="h-4 w-32" />
              <SkeletonLines lines={5} className="mt-5" />
            </CardSkeleton>
          ))}
        </div>
      </LoadingOverlay>
    </PageContainer>
  );
}

/**
 * Overview fields that depend on data Percy only sometimes sends. Whichever of these came back empty
 * for this build are listed in the closing "Fields Percy did not return" card.
 */
function overviewFields(b: Build): Row[] {
  return [
    ["Build number", b.buildNumber !== null ? `#${b.buildNumber}` : null],
    ["Project", b.projectName],
    ["Branch", b.branch],
    ["Commit", b.commit?.sha ? shortSha(b.commit.sha) : null],
    ["Commit author", b.commit?.author ?? null],
    ["Review state", b.reviewState ? humanize(b.reviewState) : null],
    ["Review reason", b.reviewStateReason ? humanize(b.reviewStateReason) : null],
    ["Total snapshots", b.totalSnapshots !== null ? count(b.totalSnapshots) : null],
    ["Total comparisons", b.totalComparisons !== null ? count(b.totalComparisons) : null],
    ["Comparisons with diffs", b.comparisonsWithDiffs !== null ? count(b.comparisonsWithDiffs) : null],
    ["Unreviewed snapshots", b.unreviewedSnapshots !== null ? count(b.unreviewedSnapshots) : null],
    ["Failed snapshots", b.failedSnapshots !== null ? count(b.failedSnapshots) : null],
    ["Open comments", b.openComments !== null ? count(b.openComments) : null],
    ["Open issues", b.openIssues !== null ? count(b.openIssues) : null],
    ["Percy processing time", b.processingSeconds !== null ? formatDuration(b.processingSeconds) : null],
    ["Percy AI results", b.ai ? "Available" : null],
    ["Test cases", b.testCases !== null ? count(b.testCases) : null],
    ["Figma design", b.figma ? "Linked" : null],
    ["Percy link", b.percyUrl],
  ];
}

/** Rows for the Build details tab, one group per widget. The widgets and the closing card both read these. */
function detailGroups(b: Build, formatDateTime: (iso: string | null) => string): Record<string, Row[]> {
  const ai = b.ai;
  return {
    review: [
      ["Review state", humanize(b.reviewState)],
      ["Reason", humanize(b.reviewStateReason)],
      ["Rejected snapshots", b.rejectedSnapshots ? count(b.rejectedSnapshots) : null],
      ["Rejection reason", b.rejectionReason],
      ["Approved at", b.approvedAt ? formatDateTime(b.approvedAt) : null],
      ["Last action", b.latestActionAt ? formatDateTime(b.latestActionAt) : null],
      ["Action reason", humanize(b.actionReasons)],
      ["Action comment", b.actionReasonsComment],
      ["Self-approval blocked", yesNo(b.selfApprovalBlocked)],
    ],
    source: [
      ["Project", b.projectName],
      ["Branch", b.branch ? <ExternalLink key="b" href={b.branchUrl}>{b.branch}</ExternalLink> : null],
      [
        "Commit",
        b.commit?.sha ? (
          <ExternalLink key="c" href={b.commitUrl}>
            <span className="font-mono">{shortSha(b.commit.sha)}</span>
          </ExternalLink>
        ) : null,
      ],
      ["Commit message", b.commit?.message?.split("\n")[0] ?? null],
      ["Author", b.commit?.author ?? null],
      [
        "Pull request",
        b.isPullRequest ? (
          <ExternalLink key="p" href={b.pullRequestUrl}>
            #{b.pullRequestNumber ?? "?"} {b.pullRequestTitle ?? ""}
          </ExternalLink>
        ) : (
          yesNo(false)
        ),
      ],
      ["Type", humanize(b.type)],
      ["Source", humanize(b.source)],
      ["Latest on branch", yesNo(b.isLatestOnBranch)],
      ["Partial build", yesNo(b.partial)],
      ["Partial results", yesNo(b.hasPartialResults)],
      ["Different base build", yesNo(b.differentBaseBuild)],
      ["Skip base-branch processing", yesNo(b.skipBaseBranchProcessing)],
      ["Skip allowed", yesNo(b.skipBaseBranchProcessingAllowed)],
    ],
    timing: [
      ["CLI started", b.cliStartedAt ? formatDateTime(b.cliStartedAt) : null],
      ["Started", formatDateTime(b.createdAt)],
      ["CI finished (finalized)", b.finalizedAt ? formatDateTime(b.finalizedAt) : null],
      ["Percy finished", b.finishedAt ? formatDateTime(b.finishedAt) : null],
      ["Last updated", formatDateTime(b.updatedAt)],
      ["Percy processing time", formatDuration(b.processingSeconds)],
      ["Total build processing", formatDuration(b.buildProcessingSeconds)],
      ["Median processing time", formatDuration(b.medianProcessingSeconds)],
      ["Average build time", formatDuration(b.averageSeconds)],
      ["Builds in average", b.buildCountForAverage !== null ? count(b.buildCountForAverage) : null],
      ["Queued", b.timings ? formatDuration(b.timings.queuedSeconds) : null],
      ["Processing (queue metrics)", b.timings ? formatDuration(b.timings.processingSeconds) : null],
      [
        "Avg / max queue wait",
        b.timings ? `${formatDuration(b.timings.queueWaitAvgSeconds)} / ${formatDuration(b.timings.queueWaitMaxSeconds)}` : null,
      ],
    ],
    aiCounts: ai?.enabled
      ? [
          ["Potential bugs", count(ai.potentialBugs)],
          ["AI visual diffs", count(ai.aiVisualDiffs)],
          ["Diffs reduced", count(ai.diffsReduced)],
          ["Diffs reduced (capped)", count(ai.diffsReducedCapped)],
          ["Snapshots analysed", count(ai.snapshotsWithAi)],
          ["Comparisons analysed", count(ai.comparisonsWithAi)],
          ["AI jobs completed", yesNo(ai.allJobsCompleted)],
        ]
      : [],
    aiSummary: ai?.enabled
      ? [
          ["Summary status", humanize(ai.summaryStatus)],
          ["Summary reason", humanize(ai.summaryReason)],
          ["Partial coverage", ai.summaryPartialCoverage ? yesNo(true) : null],
          ["Remediation status", humanize(ai.remediationStatus)],
          ["Remediation reason", humanize(ai.remediationReason)],
        ]
      : [],
    comparisons: [
      ["Total comparisons", count(b.totalComparisons)],
      ["Finished", count(b.comparisonsFinished)],
      ["With diffs", count(b.comparisonsWithDiffs)],
      ["Skipped by SmartSnap", count(b.smartSnapSkipped)],
      ["Failed snapshots", count(b.failedSnapshots)],
      ["Open comments", count(b.openComments)],
      ["Open issues", count(b.openIssues)],
      ["Snapshot approved", yesNo(b.snapshotApproved)],
    ],
    testCases:
      (b.testCases ?? 0) > 0
        ? [
            ["Total", count(b.testCases)],
            ["Unreviewed", count(b.testCasesUnreviewed)],
            ["Failed", count(b.testCasesFailed)],
            ["TestHub build", b.testhubBuildUuid ? <span key="u" className="font-mono text-xs">{b.testhubBuildUuid}</span> : null],
          ]
        : [],
    run: [
      ["Parallel nonce", b.parallelNonce],
      ["Parallel shards", b.parallelShards],
      ["Client", b.userAgent],
      ["Production build", yesNo(b.prodBuild)],
      ["Design build", yesNo(b.designBuild)],
      ["Build ID", <span key="id" className="font-mono">{b.id}</span>],
    ],
    figma: b.figma
      ? [
          ["File", b.figma.fileName],
          ["Flow", b.figma.flow],
          ["Link", b.figma.url ? <ExternalLink key="f" href={b.figma.url}>Open in Figma</ExternalLink> : null],
        ]
      : [],
  };
}

function aiSegments(b: Build): Segment[] {
  const ai = b.ai;
  if (!ai) return [];
  return [
    { key: "bugs", label: "Potential bugs", value: ai.potentialBugs ?? 0, color: "bg-red-500" },
    { key: "diffs", label: "Visual diffs", value: Math.max(0, (ai.aiVisualDiffs ?? 0) - (ai.potentialBugs ?? 0)), color: "bg-amber-400" },
    { key: "reduced", label: "Diffs reduced", value: ai.diffsReduced ?? 0, color: "bg-mint-500" },
  ];
}

/** One build with every detail the Percy builds API returns. */
export default function BuildDetails() {
  const { buildId = "" } = useParams();
  const { status, build, error, reload } = useBuild(buildId);
  const { formatDateTime, option } = useDateFormat();
  const [tab, setTab] = useState<ReportTab>("overview");
  // Only the Overview needs every snapshot, so the walk starts when that tab is open and the build is loaded.
  const allSnapshots = useAllSnapshots(build && tab === "overview" ? build.id : "", build?.totalSnapshots ?? 0);

  if (status === "loading") return <DetailsSkeleton />;

  if (error || !build) {
    return (
      <PageContainer>
        <PageHeader title="Build" backTo="/" />
        <Card className="p-5">
          <p role="alert" className="text-sm font-medium text-danger-600">{error?.message ?? "Build not found."}</p>
          {error?.hint && <p className="mt-1 text-sm text-ink-500">{error.hint}</p>}
          <div className="mt-3 flex gap-2">
            {error && (error.kind === "not_authenticated" || error.kind === "unauthorized") ? (
              <Link to="/login" className={buttonClass("primary")}>Sign in</Link>
            ) : (
              error && isRetryable(error) && <Button onClick={reload}>Try again</Button>
            )}
            <Link to="/" className={buttonClass("secondary")}>Back to builds</Link>
          </div>
        </Card>
      </PageContainer>
    );
  }

  const b = build;
  const reviewed =
    b.totalSnapshots !== null && b.unreviewedSnapshots !== null ? Math.max(0, b.totalSnapshots - b.unreviewedSnapshots) : null;
  const reviewSegments: Segment[] = [
    { key: "reviewed", label: "Reviewed", value: reviewed ?? 0, color: "bg-mint-500" },
    { key: "unreviewed", label: "Unreviewed", value: b.unreviewedSnapshots ?? 0, color: "bg-amber-400" },
    { key: "changes", label: "Requesting changes", value: b.snapshotsRequestingChanges ?? 0, color: "bg-red-500" },
  ];
  const hasTestCases = (b.testCases ?? 0) > 0;
  const ai = b.ai;
  const failed = b.state === "failed";
  const g = detailGroups(b, formatDateTime);
  const detailTitles: FactGroup[] = [
    { title: "Review progress", rows: g.review },
    { title: "Source", rows: g.source },
    { title: "Timing", rows: g.timing },
    { title: "Percy AI", rows: [...g.aiCounts, ...g.aiSummary] },
    { title: "Comparisons", rows: g.comparisons },
    { title: "Test cases", rows: g.testCases },
    { title: "Run details", rows: g.run },
    { title: "Figma", rows: g.figma },
  ];

  return (
    <PageContainer>
      <div className="flex items-start gap-3">
        <Link
          to="/"
          aria-label="Back"
          className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-900 transition-colors hover:bg-chip"
        >
          <ArrowLeft size={22} />
        </Link>
        <div className="min-w-0 flex-1">
          <ReportHeader build={b} />
        </div>
      </div>

      <TabBar
        ariaLabel="Report sections"
        value={tab}
        onChange={setTab}
        items={[
          { value: "overview", label: "Overview" },
          { value: "snapshots", label: "Snapshots", count: b.totalSnapshots ?? undefined },
          { value: "details", label: "Build details" },
        ]}
      />

      <LazyTab id="overview" active={tab === "overview"} label="Loading overview" className="space-y-6">
      {failed && (
        <Card className="border-danger-600/30 bg-danger-50 p-5">
          <p role="alert" className="text-sm font-semibold text-danger-600">This build failed: {humanize(b.failureReason)}</p>
          {b.failureDetails && <p className="mt-1 text-sm text-ink-700">{b.failureDetails}</p>}
          {b.manuallyFailedReason && <p className="mt-1 text-sm text-ink-700">{b.manuallyFailedReason}</p>}
          {b.errorBuckets.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {b.errorBuckets.map((e) => (
                <Chip key={e}>{e}</Chip>
              ))}
            </div>
          )}
          <div className="mt-3">
            <Facts rows={[["Failed by", b.failedBy], ["Failure type", humanize(b.failedType)]]} />
          </div>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Snapshots"
          value={count(b.totalSnapshots)}
          hint={`${count(b.totalComparisons)} comparisons`}
          info="Total snapshots Percy received for this build. Each snapshot is compared across every browser and width, which is what the comparison count below it shows."
        />
        <StatCard
          label="Comparisons with diffs"
          value={count(b.comparisonsWithDiffs)}
          hint={`${count(b.smartSnapSkipped)} skipped by SmartSnap`}
          info="Comparisons where Percy found a visual difference from the base build. SmartSnap skips comparisons it can prove are identical, so they are not counted as diffs."
        />
        <StatCard
          label="Unreviewed"
          value={count(b.unreviewedSnapshots)}
          hint={`${count(b.snapshotsRequestingChanges)} requesting changes`}
          info="Snapshots with changes that nobody has approved or rejected yet. Requesting changes counts snapshots a reviewer has sent back."
        />
        <StatCard
          label="Failed snapshots"
          value={count(b.failedSnapshots)}
          hint={`${count(b.openComments)} comments · ${count(b.openIssues)} issues`}
          info="Snapshots Percy could not render or process. Comments and issues are the open review threads and tracked problems on this build."
        />
      </div>

      <SnapshotSummary state={allSnapshots} buildTotal={b.totalSnapshots} buildId={b.id} />

      <NotReturnedCard groups={[{ title: "Overview", rows: overviewFields(b) }]} />
      </LazyTab>

      <LazyTab id="snapshots" active={tab === "snapshots"} label="Loading snapshots">
        <SnapshotsSection buildId={b.id} percyUrl={b.percyUrl} />
      </LazyTab>

      <LazyTab
        id="details"
        active={tab === "details"}
        label="Loading build details"
        className="gap-4 lg:columns-2 [&>*]:mb-4 [&>*]:break-inside-avoid"
      >
        <Widget title="Review progress" info="Snapshots reviewed vs still waiting for a decision.">
          <StackedBar segments={reviewSegments} />
          <ul className="mt-4 space-y-2 text-sm">
            {reviewSegments.map((s) => (
              <li key={s.key} className="flex items-center gap-3">
                <span className={`h-2 w-2 rounded-full ${s.color}`} />
                <span className="flex-1 text-ink-700">{s.label}</span>
                <span className="tabular-nums text-ink-900">{count(s.value)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <Facts rows={g.review} />
          </div>
        </Widget>

        <Widget title="Source" info="Where this build came from.">
          <Facts rows={g.source} />
        </Widget>

        <Widget
          title="Timing"
          info={`When the build ran and how long Percy took. All times are shown in ${option.label}; change the time zone from the picker at the top of the page.`}
        >
          <Facts rows={g.timing} />
        </Widget>

        <Widget
          title="Percy AI"
          info="Results from the Percy AI Review Agent: how many diffs it flagged as potential bugs, how many it filtered out as noise, and whether its summary and remediation steps ran."
        >
          {ai?.enabled ? (
            <>
              <StackedBar segments={aiSegments(b)} />
              <div className="mt-4">
                <Facts rows={g.aiCounts} />
              </div>
              <div className="mt-5">
                <Facts rows={g.aiSummary} />
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-500">Percy AI is not enabled for this build.</p>
          )}
        </Widget>

        <Widget
          title="Comparisons"
          info="A comparison is one snapshot rendered in one browser at one width and checked against the base build. This breaks down how many finished, how many differ, and how many SmartSnap skipped."
        >
          <Facts rows={g.comparisons} />
        </Widget>

        {hasTestCases && (
          <Widget
            title="Test cases"
            info="Test cases reported by BrowserStack Test Observability (TestHub) for this build, with how many still need review or failed."
          >
            <Facts rows={g.testCases} />
          </Widget>
        )}

        <Widget
          title="Run details"
          info="How this build was produced: the Percy client that uploaded it, whether it was split across parallel shards, and its build type."
        >
          <Facts rows={g.run} />
          {b.featureInteractions.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-semibold text-ink-700">State-changing feature interactions</p>
              <div className="flex flex-wrap gap-2">
                {b.featureInteractions.map((f) => (
                  <Chip key={f}>{f}</Chip>
                ))}
              </div>
            </div>
          )}
        </Widget>

        {b.figma && (
          <Widget title="Figma" info="The Figma design file this build was compared against, and the flow used.">
            <Facts rows={g.figma} />
          </Widget>
        )}

        <NotReturnedCard groups={detailTitles} />
      </LazyTab>
    </PageContainer>
  );
}