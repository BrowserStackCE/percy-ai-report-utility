import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { isRetryable } from "../api/errors";
import { useBuild } from "../api/builds/useBuild";
import type { Build, BuildState } from "../api/builds/types";
import { count, formatDuration, humanize, shortSha } from "../lib/format";
import { useDateFormat } from "../lib/dateFormat";
import {
  Button,
  Card,
  CardSkeleton,
  Chip,
  External,
  LogoLoader,
  PageContainer,
  PageHeader,
  Skeleton,
  SkeletonLines,
  StackedBar,
  StatCard,
  StatusPill,
  Widget,
  buttonClass,
  type Segment,
} from "../components/ui";

const stateTone: Record<BuildState, "mint" | "warn" | "danger" | "neutral"> = {
  finished: "mint",
  processing: "warn",
  waiting: "warn",
  failed: "danger",
  unknown: "neutral",
};

const reviewTone: Record<string, "mint" | "warn" | "danger" | "neutral"> = {
  approved: "mint",
  unreviewed: "warn",
  changes_requested: "danger",
  rejected: "danger",
};

type Row = [string, ReactNode];

/** Label / value rows used inside the detail widgets. Rows whose value is empty are hidden. */
function Facts({ rows, keepEmpty = false }: { rows: Row[]; keepEmpty?: boolean }) {
  const shown = keepEmpty ? rows : rows.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== "—");
  if (shown.length === 0) return <p className="text-sm text-ink-400">Nothing reported for this build.</p>;
  return (
    <dl className="grid grid-cols-[minmax(0,11rem)_1fr] gap-x-4 gap-y-2.5 text-sm">
      {shown.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-ink-500">{label}</dt>
          <dd className="min-w-0 break-words text-ink-900">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

const yesNo = (v: boolean) => (v ? "Yes" : "No");

function ExternalLink({ href, children }: { href: string | null; children: ReactNode }) {
  if (!href) return <>{children}</>;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
      {children}
    </a>
  );
}

/** Small coloured tag for boolean build flags. */
function Flag({ on, label }: { on: boolean; label: string }) {
  return on ? <Chip>{label}</Chip> : null;
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
      <LogoLoader label="Loading build" className="py-6" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <CardSkeleton key={i}>
            <Skeleton className="h-4 w-32" />
            <SkeletonLines lines={5} className="mt-5" />
          </CardSkeleton>
        ))}
      </div>
    </PageContainer>
  );
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

  if (status === "loading") return <DetailsSkeleton />;

  if (error || !build) {
    return (
      <PageContainer>
        <PageHeader title="Build" backTo="/" />
        <Card className="p-5">
          <p role="alert" className="text-sm font-medium text-red-600">{error?.message ?? "Build not found."}</p>
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

  return (
    <PageContainer>
      <PageHeader
        title={`Build ${b.buildNumber !== null ? `#${b.buildNumber}` : b.id}`}
        backTo="/"
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={stateTone[b.state]}>{humanize(b.state)}</StatusPill>
            {b.reviewState && <StatusPill tone={reviewTone[b.reviewState] ?? "neutral"}>{humanize(b.reviewState)}</StatusPill>}
            {b.branch && <Chip>{b.branch}</Chip>}
            {b.commit?.sha && <Chip mono>{shortSha(b.commit.sha)}</Chip>}
            <Flag on={b.isLatestOnBranch} label="Latest on branch" />
            <Flag on={b.partial} label="Partial" />
            <Flag on={b.prodBuild} label="Production" />
            <Flag on={b.designBuild} label="Design" />
          </div>
        }
        description={[b.projectName, b.pullRequestTitle].filter(Boolean).join(" · ") || undefined}
        actions={
          b.percyUrl ? (
            <a href={b.percyUrl} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              <External size={16} />
              Open in Percy
            </a>
          ) : undefined
        }
      />

      {failed && (
        <Card className="border-red-200 p-5">
          <p role="alert" className="text-sm font-semibold text-red-600">This build failed: {humanize(b.failureReason)}</p>
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

      <div className="grid gap-4 lg:grid-cols-2">
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
          <div className="mt-4 border-t border-line pt-4">
            <Facts
              rows={[
                ["Review state", humanize(b.reviewState)],
                ["Reason", humanize(b.reviewStateReason)],
                ["Rejected snapshots", b.rejectedSnapshots ? count(b.rejectedSnapshots) : null],
                ["Rejection reason", b.rejectionReason],
                ["Approved at", b.approvedAt ? formatDateTime(b.approvedAt) : null],
                ["Last action", b.latestActionAt ? formatDateTime(b.latestActionAt) : null],
                ["Action reason", humanize(b.actionReasons)],
                ["Action comment", b.actionReasonsComment],
                ["Self-approval blocked", yesNo(b.selfApprovalBlocked)],
              ]}
            />
          </div>
        </Widget>

        <Widget title="Source" info="Where this build came from.">
          <Facts
            rows={[
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
                  "No"
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
            ]}
          />
        </Widget>

        <Widget
          title="Timing"
          info={`When the build ran and how long Percy took. All times are shown in ${option.label}; change the time zone from the picker at the top of the page.`}
        >
          <Facts
            rows={[
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
                b.timings
                  ? `${formatDuration(b.timings.queueWaitAvgSeconds)} / ${formatDuration(b.timings.queueWaitMaxSeconds)}`
                  : null,
              ],
            ]}
          />
        </Widget>

        <Widget
          title="Percy AI"
          info="Results from the Percy AI Review Agent: how many diffs it flagged as potential bugs, how many it filtered out as noise, and whether its summary and remediation steps ran."
        >
          {ai?.enabled ? (
            <>
              <StackedBar segments={aiSegments(b)} />
              <div className="mt-4">
                <Facts
                  keepEmpty
                  rows={[
                    ["Potential bugs", count(ai.potentialBugs)],
                    ["AI visual diffs", count(ai.aiVisualDiffs)],
                    ["Diffs reduced", count(ai.diffsReduced)],
                    ["Diffs reduced (capped)", count(ai.diffsReducedCapped)],
                    ["Snapshots analysed", count(ai.snapshotsWithAi)],
                    ["Comparisons analysed", count(ai.comparisonsWithAi)],
                    ["AI jobs completed", yesNo(ai.allJobsCompleted)],
                  ]}
                />
              </div>
              <div className="mt-4 border-t border-line pt-4">
                <Facts
                  rows={[
                    ["Summary status", humanize(ai.summaryStatus)],
                    ["Summary reason", humanize(ai.summaryReason)],
                    ["Partial coverage", ai.summaryPartialCoverage ? "Yes" : null],
                    ["Remediation status", humanize(ai.remediationStatus)],
                    ["Remediation reason", humanize(ai.remediationReason)],
                  ]}
                />
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
          <Facts
            keepEmpty
            rows={[
              ["Total comparisons", count(b.totalComparisons)],
              ["Finished", count(b.comparisonsFinished)],
              ["With diffs", count(b.comparisonsWithDiffs)],
              ["Skipped by SmartSnap", count(b.smartSnapSkipped)],
              ["Failed snapshots", count(b.failedSnapshots)],
              ["Open comments", count(b.openComments)],
              ["Open issues", count(b.openIssues)],
              ["Snapshot approved", yesNo(b.snapshotApproved)],
            ]}
          />
        </Widget>

        {hasTestCases && (
          <Widget
            title="Test cases"
            info="Test cases reported by BrowserStack Test Observability (TestHub) for this build, with how many still need review or failed."
          >
            <Facts
              keepEmpty
              rows={[
                ["Total", count(b.testCases)],
                ["Unreviewed", count(b.testCasesUnreviewed)],
                ["Failed", count(b.testCasesFailed)],
                ["TestHub build", b.testhubBuildUuid ? <span key="u" className="font-mono text-xs">{b.testhubBuildUuid}</span> : null],
              ]}
            />
          </Widget>
        )}

        <Widget
          title="Run details"
          info="How this build was produced: the Percy client that uploaded it, whether it was split across parallel shards, and its build type."
        >
          <Facts
            keepEmpty
            rows={[
              ["Parallel nonce", b.parallelNonce],
              ["Parallel shards", b.parallelShards],
              ["Client", b.userAgent],
              ["Production build", yesNo(b.prodBuild)],
              ["Design build", yesNo(b.designBuild)],
              ["Build ID", <span key="id" className="font-mono">{b.id}</span>],
            ]}
          />
          {b.featureInteractions.length > 0 && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-sm text-ink-500">State-changing feature interactions</p>
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
            <Facts
              rows={[
                ["File", b.figma.fileName],
                ["Flow", b.figma.flow],
                ["Link", b.figma.url ? <ExternalLink key="f" href={b.figma.url}>Open in Figma</ExternalLink> : null],
              ]}
            />
          </Widget>
        )}
      </div>
    </PageContainer>
  );
}