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
  AccentStat,
  ArrowLeft,
  Bug,
  Button,
  Calendar,
  Card,
  CardSkeleton,
  Chip,
  Clock,
  GitBranch,
  Layers,
  LoadingOverlay,
  PageContainer,
  PageHeader,
  Pulse,
  Skeleton,
  SkeletonLines,
  Sparkles,
  StackedBar,
  StatCard,
  StatusPill,
  TabBar,
  User,
  Widget,
  accentStyles,
  buttonClass,
  cn,
  type AccentTone,
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
function Facts({ rows, tone = "brand" }: { rows: Row[]; tone?: AccentTone }) {
  const present = rows.filter(([, v]) => !isMissing(v));
  if (present.length === 0) return <p className="text-sm text-ink-400">Nothing returned for this section.</p>;
  const a = accentStyles[tone];
  return (
    <dl className="grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
      {present.map(([label, value]) => (
        <div key={label} className={cn("relative min-w-0 overflow-hidden rounded-lg border bg-card px-3.5 py-2.5 pl-4", a.border)}>
          <span aria-hidden="true" className={cn("absolute inset-y-0 left-0 w-1", a.bar)} />
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">{label}</dt>
          <dd className="mt-0.5 min-w-0 break-words font-medium text-ink-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A details card: coloured icon chip and title in a tinted header, content below. */
function DetailSection({
  title,
  info,
  tone,
  icon,
  children,
}: {
  title: string;
  info?: string;
  tone: AccentTone;
  icon: ReactNode;
  children: ReactNode;
}) {
  const a = accentStyles[tone];
  return (
    <section className="overflow-hidden rounded-xl border border-line bg-card shadow-[var(--shadow-card)]">
      <header className={cn("flex items-center gap-3 border-b px-5 py-3", a.surface, a.border)}>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-on-brand)]", a.chip)}>{icon}</span>
        <div className="min-w-0">
          <h2 className={cn("text-[15px] font-semibold", a.text)}>{title}</h2>
          {info && <p className="truncate text-xs text-ink-500" title={info}>{info}</p>}
        </div>
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Vertical timeline of when the build happened, oldest first. Skips timestamps Percy did not send. */
function BuildTimeline({ b, formatDateTime }: { b: Build; formatDateTime: (iso: string | null) => string }) {
  const steps: { label: string; at: string | null; tone: AccentTone }[] = [
    { label: "CLI started", at: b.cliStartedAt, tone: "info" },
    { label: "Build created", at: b.createdAt, tone: "brand" },
    { label: "CI finalized", at: b.finalizedAt, tone: "teal" },
    { label: "Percy finished", at: b.finishedAt, tone: "mint" },
    { label: "Approved", at: b.approvedAt, tone: "mint" },
  ];
  const shown = steps.filter((s) => s.at);
  if (shown.length === 0) return null;
  return (
    <ol className="relative ml-2 space-y-4 border-l-2 border-line pl-6">
      {shown.map((s) => (
        <li key={s.label} className="relative">
          <span aria-hidden="true" className={cn("absolute -left-[33px] top-1 h-3 w-3 rounded-full ring-4 ring-card", accentStyles[s.tone].bar)} />
          <p className="text-sm font-semibold text-ink-900">{s.label}</p>
          <p className="text-xs text-ink-500">{formatDateTime(s.at)}</p>
        </li>
      ))}
    </ol>
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

      <LazyTab id="details" active={tab === "details"} label="Loading build details" className="space-y-5">
        {/* Report summary: the headline numbers of the build in coloured tiles. */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AccentStat
            tone={b.state === "failed" ? "danger" : b.state === "finished" ? "mint" : "warn"}
            icon={<Pulse size={16} />}
            label="Build status"
            value={humanize(b.state)}
            hint={b.reviewState ? `Review: ${humanize(b.reviewState)}` : "Review state not returned"}
          />
          <AccentStat
            tone="info"
            icon={<Layers size={16} />}
            label="Snapshots"
            value={count(b.totalSnapshots)}
            hint={`${count(b.totalComparisons)} comparisons · ${count(b.comparisonsWithDiffs)} with diffs`}
          />
          <AccentStat
            tone="warn"
            icon={<Clock size={16} />}
            label="Percy processing"
            value={formatDuration(b.processingSeconds)}
            hint={b.averageSeconds !== null ? `Average build ${formatDuration(b.averageSeconds)}` : "Average not returned"}
          />
          <AccentStat
            tone={ai?.enabled ? "brand" : "teal"}
            icon={<Sparkles size={16} />}
            label="Percy AI"
            value={ai?.enabled ? count(ai.aiVisualDiffs) : "Off"}
            hint={ai?.enabled ? `${count(ai.potentialBugs)} potential bugs · ${count(ai.diffsReduced)} diffs reduced` : "Not enabled for this build"}
          />
        </div>

        <div className="grid items-start gap-5 lg:grid-cols-2">
          <DetailSection title="Review progress" tone="mint" icon={<Sparkles size={16} />} info="Snapshots reviewed vs still waiting for a decision.">
            <StackedBar segments={reviewSegments} />
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
              {reviewSegments.map((s) => (
                <li key={s.key} className="rounded-lg border border-line bg-surface/60 px-3 py-2">
                  <span className="flex items-center gap-2 text-xs text-ink-500">
                    <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-xl font-semibold tabular-nums text-ink-900">{count(s.value)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <Facts rows={g.review} tone="mint" />
            </div>
          </DetailSection>

          <DetailSection
            title="Timeline"
            tone="info"
            icon={<Calendar size={16} />}
            info={`All times are shown in ${option.label}; change the time zone from the picker at the top of the page.`}
          >
            <BuildTimeline b={b} formatDateTime={formatDateTime} />
            <div className="mt-5">
              <Facts rows={g.timing} tone="info" />
            </div>
          </DetailSection>

          <DetailSection title="Source" tone="brand" icon={<GitBranch size={16} />} info="Where this build came from.">
            <Facts rows={g.source} tone="brand" />
          </DetailSection>

          <DetailSection
            title="Percy AI"
            tone="brand"
            icon={<Sparkles size={16} />}
            info="Results from the Percy AI Review Agent: diffs flagged as potential bugs, diffs filtered as noise, and whether its summary and remediation ran."
          >
            {ai?.enabled ? (
              <>
                <StackedBar segments={aiSegments(b)} />
                <div className="mt-4">
                  <Facts rows={g.aiCounts} tone="brand" />
                </div>
                <div className="mt-4">
                  <Facts rows={g.aiSummary} tone="teal" />
                </div>
              </>
            ) : (
              <p className="text-sm text-ink-500">Percy AI is not enabled for this build.</p>
            )}
          </DetailSection>

          <DetailSection
            title="Comparisons"
            tone="warn"
            icon={<Layers size={16} />}
            info="One snapshot rendered in one browser at one width and checked against the base build."
          >
            <Facts rows={g.comparisons} tone="warn" />
          </DetailSection>

          {hasTestCases && (
            <DetailSection title="Test cases" tone="teal" icon={<Bug size={16} />} info="Test cases reported by BrowserStack Test Observability (TestHub) for this build.">
              <Facts rows={g.testCases} tone="teal" />
            </DetailSection>
          )}

          <DetailSection
            title="Run details"
            tone="info"
            icon={<User size={16} />}
            info="How this build was produced: the Percy client, parallel shards and build type."
          >
            <Facts rows={g.run} tone="info" />
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
          </DetailSection>

          {b.figma && (
            <DetailSection title="Figma" tone="danger" icon={<Layers size={16} />} info="The Figma design file this build was compared against.">
              <Facts rows={g.figma} tone="danger" />
            </DetailSection>
          )}
        </div>

        <NotReturnedCard groups={detailTitles} />
      </LazyTab>
    </PageContainer>
  );
}