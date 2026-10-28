import { useMemo } from "react";
import { Link, Navigate } from "react-router";
import { MAX_ANALYTICS_PAGES, useAllBuilds } from "../api/builds/useAllBuilds";
import {
  buildTrend,
  failureAnalysis,
  parallelIntegrity,
  pullRequestQuality,
  reviewSla,
  reviewerWorkload,
  type PullRequestRow,
  type ReviewerRow,
} from "../api/builds/analytics";
import {
  aiEffectiveness,
  commentHotspots,
  diffDistribution,
  noisiestSnapshots,
  renderingRisk,
  responsiveAnalysis,
  reviewBreakdown,
  testCaseTraceability,
  type DiffRateRow,
  type NoisySnapshot,
  type TestCaseRow,
} from "../api/snapshots/analytics";
import { SNAPSHOT_PAGES_PER_BUILD, SNAPSHOT_REPORT_BUILDS, useProjectSnapshots } from "../api/snapshots/useProjectSnapshots";
import type { Build } from "../api/builds/types";
import { isRetryable } from "../api/errors";
import { useProjects } from "../api/projects/useProjects";
import { useSelectedProject } from "../api/projects/SelectedProjectProvider";
import { count, formatDuration, humanize } from "../lib/format";
import { useDateFormat } from "../lib/dateFormat";
import {
  BarChart,
  Button,
  Card,
  DataTable,
  EmptyState,
  LegendRows,
  LoadingOverlay,
  PageContainer,
  PageHeader,
  StatusPill,
  TableSkeleton,
  Widget,
  buttonClass,
  type Column,
  type Segment,
} from "../components/ui";
import { StatCard } from "../components/ui/Card";

const pct = (n: number | null) => (n === null ? "—" : `${n.toFixed(n >= 10 || n === 0 ? 0 : 1)}%`);

const reviewTone: Record<string, "mint" | "warn" | "danger" | "neutral"> = {
  approved: "mint",
  unreviewed: "warn",
  changes_requested: "danger",
  rejected: "danger",
};

function BuildLink({ build }: { build: Build }) {
  return (
    <Link to={`/reports/${build.id}`} className="font-semibold text-ink-900 hover:text-brand-600">
      {build.buildNumber !== null ? `#${build.buildNumber}` : build.id}
    </Link>
  );
}

function ReviewPill({ state }: { state: string | null }) {
  return <StatusPill tone={(state && reviewTone[state]) || "neutral"}>{humanize(state)}</StatusPill>;
}

/** Page section wrapper: heading with the B-number, plus a description of what the numbers mean. */
function Section({ id, title, info, children }: { id: string; title: string; info: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="space-y-3" data-testid={`section-${id}`}>
      <div>
        <h2 id={`${id}-h`} className="text-lg font-semibold text-ink-900">
          {title}
        </h2>
        <p className="text-sm text-ink-500">{info}</p>
      </div>
      {children}
    </section>
  );
}

export default function Analytics() {
  const { projectId } = useSelectedProject();
  const { projects } = useProjects();
  const { status, builds, error, truncated, pagesLoaded, reload } = useAllBuilds(projectId);
  const { formatDateTime, zone } = useDateFormat();

  const trend = useMemo(() => buildTrend(builds), [builds]);
  const sla = useMemo(() => reviewSla(builds), [builds]);
  const failures = useMemo(() => failureAnalysis(builds), [builds]);
  const prs = useMemo(() => pullRequestQuality(builds), [builds]);
  const parallel = useMemo(() => parallelIntegrity(builds), [builds]);
  const reviewers = useMemo(() => reviewerWorkload(builds), [builds]);

  // Snapshot reports (C1–C8): the newest finished builds, with their snapshots and comparisons.
  const snaps = useProjectSnapshots(projectId);
  const allSnapshots = useMemo(() => snaps.builds.flatMap((b) => b.snapshots), [snaps.builds]);
  const noisy = useMemo(() => noisiestSnapshots(snaps.builds), [snaps.builds]);
  const distribution = useMemo(() => diffDistribution(allSnapshots), [allSnapshots]);
  const ai = useMemo(() => aiEffectiveness(allSnapshots), [allSnapshots]);
  const review = useMemo(() => reviewBreakdown(allSnapshots), [allSnapshots]);
  const comments = useMemo(() => commentHotspots(allSnapshots), [allSnapshots]);
  const rendering = useMemo(() => renderingRisk(allSnapshots), [allSnapshots]);
  const testCases = useMemo(() => testCaseTraceability(allSnapshots), [allSnapshots]);
  const responsive = useMemo(() => responsiveAnalysis(allSnapshots), [allSnapshots]);

  const project = projects.find((p) => p.id === projectId);

  const waitingColumns = useMemo<Column<{ build: Build; waitingSeconds: number }>[]>(
    () => [
      { key: "build", header: "Build", render: (r) => <BuildLink build={r.build} /> },
      { key: "branch", header: "Branch", render: (r) => r.build.branch ?? "—" },
      {
        key: "pr",
        header: "Pull request",
        render: (r) =>
          r.build.pullRequestUrl ? (
            <a href={r.build.pullRequestUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
              #{r.build.pullRequestNumber}
            </a>
          ) : (
            "—"
          ),
      },
      { key: "diffs", header: "Diffs", align: "right", render: (r) => count(r.build.comparisonsWithDiffs) },
      { key: "finished", header: "Finished", render: (r) => formatDateTime(r.build.finishedAt) },
      { key: "waiting", header: "Waiting", align: "right", render: (r) => formatDuration(r.waitingSeconds) },
    ],
    [formatDateTime, zone],
  );

  const prColumns = useMemo<Column<PullRequestRow>[]>(
    () => [
      {
        key: "pr",
        header: "Pull request",
        render: (r) => (
          <div className="min-w-0">
            {r.url ? (
              <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline">
                #{r.number}
              </a>
            ) : (
              <span className="font-semibold text-ink-900">#{r.number}</span>
            )}
            <p className="max-w-xs truncate text-xs text-ink-500" title={r.title ?? undefined}>
              {r.title ?? ""}
            </p>
          </div>
        ),
      },
      { key: "builds", header: "Builds", align: "right", render: (r) => r.builds },
      { key: "diffs", header: "Builds with diffs", align: "right", render: (r) => r.buildsWithDiffs },
      { key: "bad", header: "Rejected / changes requested", align: "right", render: (r) => r.rejectedOrChanges },
      { key: "final", header: "Latest build", render: (r) => <ReviewPill state={r.finalState} /> },
    ],
    [],
  );

  const noisyColumns = useMemo<Column<NoisySnapshot>[]>(
    () => [
      {
        key: "name",
        header: "Snapshot",
        render: (r) => (
          <span className="block max-w-xs truncate" title={r.name}>
            {r.name}
          </span>
        ),
      },
      { key: "seen", header: "Builds seen", align: "right", render: (r) => r.appearances },
      { key: "diff", header: "Builds with a diff", align: "right", render: (r) => r.withDiff },
      { key: "rate", header: "Diff rate", align: "right", render: (r) => pct(r.diffRatePct) },
      { key: "avg", header: "Average change", align: "right", render: (r) => pct(r.averageRatio * 100) },
      { key: "re", header: "Reintroduced", align: "right", render: (r) => r.reintroduced },
      { key: "last", header: "Last diff in build", align: "right", render: (r) => (r.lastSeenBuild !== null ? `#${r.lastSeenBuild}` : "—") },
    ],
    [],
  );

  const testCaseColumns = useMemo<Column<TestCaseRow>[]>(
    () => [
      { key: "test", header: "Test case", render: (r) => <span className="block max-w-xs truncate" title={r.testCase}>{r.testCase}</span> },
      { key: "snaps", header: "Snapshots", align: "right", render: (r) => r.snapshots },
      { key: "diff", header: "With a diff", align: "right", render: (r) => r.withDiff },
      { key: "avg", header: "Average change", align: "right", render: (r) => pct(r.averageRatio * 100) },
      {
        key: "debug",
        header: "Session",
        render: (r) =>
          r.debugUrl ? (
            <a href={r.debugUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
              Open
            </a>
          ) : (
            "—"
          ),
      },
    ],
    [],
  );

  const rateColumns = useMemo<Column<DiffRateRow>[]>(
    () => [
      { key: "label", header: "Group", render: (r) => r.label },
      { key: "cmp", header: "Comparisons", align: "right", render: (r) => r.comparisons },
      { key: "diff", header: "With a diff", align: "right", render: (r) => r.withDiff },
      { key: "rate", header: "Diff rate", align: "right", render: (r) => pct(r.diffRatePct) },
    ],
    [],
  );

  const reviewerColumns = useMemo<Column<ReviewerRow>[]>(
    () => [
      { key: "who", header: "Reviewer", render: (r) => r.reviewer },
      { key: "n", header: "Approvals", align: "right", render: (r) => r.approvals },
      { key: "med", header: "Median time to approve", align: "right", render: (r) => formatDuration(r.medianSeconds) },
      { key: "last", header: "Last approval", render: (r) => formatDateTime(r.lastApprovedAt) },
    ],
    [formatDateTime, zone],
  );

  if (!projectId) return <Navigate to="/projects" replace />;

  const reviewSegments: Segment[] = [
    { key: "approved", label: "Approved", value: trend.days.reduce((s, d) => s + d.approved, 0), color: "bg-mint-500" },
    { key: "unreviewed", label: "Unreviewed", value: trend.days.reduce((s, d) => s + d.unreviewed, 0), color: "bg-warn-500" },
    { key: "changes", label: "Changes requested", value: trend.days.reduce((s, d) => s + d.changesRequested, 0), color: "bg-brand-500" },
    { key: "rejected", label: "Rejected", value: trend.days.reduce((s, d) => s + d.rejected, 0), color: "bg-danger-600" },
    { key: "failed", label: "Failed", value: trend.days.reduce((s, d) => s + d.failed, 0), color: "bg-ink-500" },
  ];

  const loading = status === "loading" && builds.length === 0;

  return (
    <PageContainer>
      <PageHeader
        title="Build analytics"
        description={`Trends across ${project ? project.name : "the selected project"} builds from the last 30 days.`}
        actions={
          <div className="flex gap-2">
            <Button onClick={reload}>Refresh</Button>
            <Link to="/" className={buttonClass("secondary")}>
              Back to reports
            </Link>
          </div>
        }
      />

      {error ? (
        <Card className="p-5">
          <p role="alert" className="text-sm font-medium text-red-600">
            {error.message}
          </p>
          {error.hint && <p className="mt-1 text-sm text-ink-500">{error.hint}</p>}
          <div className="mt-3 flex gap-2">
            {error.kind === "not_authenticated" || error.kind === "unauthorized" ? (
              <Link to="/login" className={buttonClass("primary")}>
                Sign in
              </Link>
            ) : (
              isRetryable(error) && <Button onClick={reload}>Try again</Button>
            )}
          </div>
        </Card>
      ) : loading ? (
        <LoadingOverlay label="Loading builds for analytics">
          <TableSkeleton rows={6} cols={6} />
        </LoadingOverlay>
      ) : builds.length === 0 ? (
        <EmptyState title="No builds to analyse" description="There are no builds in the last 30 days for this project." />
      ) : (
        <div className="space-y-8">
          {status === "loading" && (
            <p className="text-sm text-ink-500" role="status">
              Loading more builds… ({pagesLoaded} page{pagesLoaded === 1 ? "" : "s"} so far)
            </p>
          )}
          {truncated && (
            <p className="rounded-lg bg-warn-50 px-3 py-2 text-sm text-warn-700" role="note">
              Showing the newest {builds.length} builds (first {MAX_ANALYTICS_PAGES} pages). Older builds in the 30-day window were not
              included.
            </p>
          )}

          {/* B1 */}
          <Section
            id="b1"
            title="Build trend"
            info="Builds per day, split by review outcome. The diff rate is the share of finished builds that had at least one visual difference."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Builds analysed" value={count(trend.totalBuilds)} hint="Last 30 days" />
              <StatCard
                label="Builds with diffs"
                value={pct(trend.diffRatePct)}
                hint="Of finished builds"
                info="Finished builds where Percy found at least one comparison with a visual difference."
              />
              <StatCard label="Failed builds" value={count(failures.failedBuilds)} hint={`${pct(failures.failureRatePct)} of builds`} />
            </div>
            <Widget title="Builds per day">
              <BarChart
                ariaLabel="Builds per day by review state"
                groups={trend.days.map((d) => ({
                  label: d.day.slice(5),
                  segments: [
                    { key: "approved", label: "Approved", value: d.approved, color: "bg-mint-500" },
                    { key: "unreviewed", label: "Unreviewed", value: d.unreviewed, color: "bg-warn-500" },
                    { key: "changes", label: "Changes requested", value: d.changesRequested, color: "bg-brand-500" },
                    { key: "rejected", label: "Rejected", value: d.rejected, color: "bg-danger-600" },
                    { key: "failed", label: "Failed", value: d.failed, color: "bg-ink-500" },
                    { key: "other", label: "Other", value: d.other, color: "bg-ink-300" },
                  ],
                }))}
              />
              <div className="mt-4">
                <LegendRows segments={reviewSegments} />
              </div>
            </Widget>
          </Section>

          {/* B2 */}
          <Section
            id="b2"
            title="Review turnaround"
            info="How long builds wait between Percy finishing them and someone approving them, and which builds are still waiting."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Reviewed builds" value={count(sla.reviewedCount)} hint="Approved with a timestamp" />
              <StatCard label="Median time to approve" value={formatDuration(sla.medianSeconds)} hint="Finished to approved" />
              <StatCard label="Slowest 10% took" value={formatDuration(sla.p90Seconds)} hint="90th percentile" />
            </div>
            <Widget title={`Waiting for review (${sla.waiting.length})`} info="Finished builds that have diffs and are still unreviewed. Longest wait first.">
              <DataTable
                columns={waitingColumns}
                rows={sla.waiting}
                rowKey={(r) => r.build.id}
                empty="Nothing is waiting for review."
              />
            </Widget>
          </Section>

          {/* B4 */}
          <Section
            id="b4"
            title="Failure analysis"
            info="Why builds and snapshots failed, and builds that CI never finalised."
          >
            <div className="grid gap-4 sm:grid-cols-4">
              <StatCard label="Failed builds" value={count(failures.failedBuilds)} hint={`${pct(failures.failureRatePct)} of builds`} />
              <StatCard label="Builds with failed snapshots" value={count(failures.buildsWithFailedSnapshots)} hint="At least one failed snapshot" />
              <StatCard label="Failed snapshots" value={count(failures.totalFailedSnapshots)} hint="Total across builds" />
              <StatCard label="Never finalised" value={count(failures.neverFinalized.length)} hint="CI did not complete them" />
            </div>
            <Widget title="Failure reasons">
              {failures.reasons.length === 0 ? (
                <p className="text-sm text-ink-500">No failed builds in this window.</p>
              ) : (
                <LegendRows
                  segments={failures.reasons.map((r, i) => ({
                    key: `${r.reason}-${i}`,
                    label: humanize(r.reason),
                    value: r.count,
                    color: "bg-danger-600",
                  }))}
                />
              )}
            </Widget>
          </Section>

          {/* B5 */}
          <Section
            id="b5"
            title="Pull request quality"
            info="For each pull request: how many builds it needed, how many had diffs, and the review state of its latest build."
          >
            <DataTable columns={prColumns} rows={prs} rowKey={(r) => String(r.number)} empty="No pull-request builds in this window." />
          </Section>

          {/* B6 */}
          <Section
            id="b6"
            title="Parallel and partial builds"
            info="Partial builds do not cover the whole suite. Parallel runs share a nonce; a run with fewer builds than shards may be incomplete."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard label="Partial builds" value={count(parallel.partialBuilds.length)} hint="Not a full run" />
              <StatCard label="Parallel runs" value={count(parallel.groups.length)} hint="Builds sharing a nonce" />
              <StatCard label="Possibly incomplete" value={count(parallel.incompleteGroups.length)} hint="Fewer builds than shards" />
            </div>
            {parallel.incompleteGroups.length > 0 && (
              <Widget title="Parallel runs missing shards">
                <ul className="space-y-2 text-sm text-ink-700">
                  {parallel.incompleteGroups.map((g) => (
                    <li key={g.nonce}>
                      <span className="font-mono text-xs">{g.nonce}</span> — {g.builds.length} of {g.expectedShards} shards
                    </li>
                  ))}
                </ul>
              </Widget>
            )}
          </Section>

          {/* B8 */}
          <Section
            id="b8"
            title="Reviewer workload"
            info="Approvals per person. Builds where Percy did not return the approver are grouped as Unknown."
          >
            <DataTable columns={reviewerColumns} rows={reviewers} rowKey={(r) => r.reviewer} empty="No approved builds in this window." />
          </Section>

          {/* Snapshot reports (C1–C8) */}
          <div className="border-t border-line pt-8">
            <h2 className="text-xl font-semibold text-ink-900">Snapshot analytics</h2>
            <p className="text-sm text-ink-500">
              Based on the {SNAPSHOT_REPORT_BUILDS} newest finished builds, up to {SNAPSHOT_PAGES_PER_BUILD * 30} snapshots each.
            </p>
          </div>

          {snaps.error ? (
            <Card className="p-5">
              <p role="alert" className="text-sm font-medium text-red-600">
                {snaps.error.message}
              </p>
              {snaps.error.hint && <p className="mt-1 text-sm text-ink-500">{snaps.error.hint}</p>}
              {isRetryable(snaps.error) && (
                <div className="mt-3">
                  <Button onClick={snaps.reload}>Try again</Button>
                </div>
              )}
            </Card>
          ) : snaps.status === "loading" && snaps.builds.length === 0 ? (
            <LoadingOverlay label="Loading snapshots">
              <TableSkeleton rows={4} cols={5} />
            </LoadingOverlay>
          ) : allSnapshots.length === 0 ? (
            <EmptyState title="No snapshots to analyse" description="There are no finished builds with snapshots for this project yet." />
          ) : (
            <div className="space-y-8">
              {snaps.status === "loading" && (
                <p className="text-sm text-ink-500" role="status">
                  Loading snapshots… ({snaps.buildsLoaded} of {snaps.buildsTotal} builds)
                </p>
              )}
              {snaps.truncated && (
                <p className="rounded-lg bg-warn-50 px-3 py-2 text-sm text-warn-700" role="note">
                  Some builds have more than {SNAPSHOT_PAGES_PER_BUILD * 30} snapshots, so only the first {SNAPSHOT_PAGES_PER_BUILD * 30} of each were included.
                </p>
              )}

              {/* C1 */}
              <Section
                id="c1"
                title="Noisiest snapshots"
                info="Snapshots that show a diff in many builds. A high diff rate usually means flaky content (dates, ads, animations) rather than a real change."
              >
                <DataTable columns={noisyColumns} rows={noisy.slice(0, 20)} rowKey={(r) => r.name} empty="No snapshot shows a diff in more than one build." />
              </Section>

              {/* C2 */}
              <Section
                id="c2"
                title="Diff size and AI noise removal"
                info="How much of the page changed. Percy AI filters out noise, so the AI figure is usually smaller than the raw one."
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard label="Comparisons with a diff" value={count(distribution.comparisonsWithDiff)} hint="After AI filtering" />
                  <StatCard
                    label="Noise removed by AI"
                    value={pct(distribution.noiseRemovedPct)}
                    hint="Raw diff vs AI diff"
                    info="How much smaller the average diff is once Percy AI has filtered noise. Only comparisons with both figures count."
                  />
                  <StatCard
                    label="Average raw change"
                    value={distribution.averageRawRatio === null ? "—" : pct(distribution.averageRawRatio * 100)}
                    hint="Share of the page that changed"
                  />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Widget title="Diff size">
                    <BarChart
                      ariaLabel="Comparisons by diff size"
                      groups={distribution.buckets.map((b) => ({
                        label: b.label,
                        segments: [{ key: b.key, label: b.label, value: b.count, color: "bg-brand-500" }],
                      }))}
                    />
                  </Widget>
                  <Widget title="Biggest changes">
                    <ul className="space-y-2 text-sm text-ink-700">
                      {distribution.top.length === 0 && <li className="text-ink-500">No diffs found.</li>}
                      {distribution.top.map((t, i) => (
                        <li key={`${t.name}-${i}`} className="flex items-center justify-between gap-3">
                          <span className="min-w-0 flex-1 truncate" title={t.name}>
                            {t.name}
                          </span>
                          <span className="tabular-nums">{pct(t.ratio * 100)}</span>
                        </li>
                      ))}
                    </ul>
                  </Widget>
                </div>
              </Section>

              {/* C3 */}
              <Section
                id="c3"
                title="Percy AI effectiveness"
                info="How much review work Percy AI took off your team, and how often it failed."
              >
                <div className="grid gap-4 sm:grid-cols-4">
                  <StatCard label="AI-enabled comparisons" value={count(ai.aiEnabled)} hint={`Of ${count(ai.comparisons)} comparisons`} />
                  <StatCard label="Raw diffs" value={count(ai.rawDiffs)} hint="Before AI filtering" />
                  <StatCard label="Cleared by AI" value={count(ai.cleared)} hint="Diff removed entirely" />
                  <StatCard label="AI failures" value={count(ai.aiFailed)} hint="Could not be analysed" />
                </div>
                {ai.failureReasons.length > 0 && (
                  <Widget title="AI failure reasons">
                    <LegendRows
                      segments={ai.failureReasons.map((r, i) => ({ key: `${r.reason}-${i}`, label: humanize(r.reason), value: r.count, color: "bg-danger-600" }))}
                    />
                  </Widget>
                )}
              </Section>

              {/* C4 */}
              <Section
                id="c4"
                title="Review state and reasons"
                info="Where each snapshot stands, and why. Auto-approved snapshots matched an auto-approve branch; human-approved ones were reviewed by a person."
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <StatCard label="Auto-approved" value={count(review.autoApproved)} hint="By branch rules" />
                  <StatCard label="Human-approved" value={count(review.humanApproved)} hint="Reviewed by a person" />
                  <StatCard label="Still outstanding" value={count(review.outstanding)} hint="Unreviewed or changes requested" />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <Widget title="By review state">
                    <LegendRows segments={review.states.map((s) => ({ key: s.state, label: humanize(s.state), value: s.count, color: "bg-brand-500" }))} />
                  </Widget>
                  <Widget title="By reason">
                    {review.reasons.length === 0 ? (
                      <p className="text-sm text-ink-500">Percy did not return review reasons.</p>
                    ) : (
                      <LegendRows segments={review.reasons.map((s) => ({ key: s.reason, label: humanize(s.reason), value: s.count, color: "bg-warn-500" }))} />
                    )}
                  </Widget>
                </div>
              </Section>

              {/* C5 */}
              <Section
                id="c5"
                title="Open comments"
                info="Snapshots with unresolved review comments, most comments first."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <StatCard label="Open comments" value={count(comments.total)} hint="Across loaded snapshots" />
                  <StatCard label="Snapshots with comments" value={count(comments.snapshotsWithComments)} hint="At least one open comment" />
                </div>
                {comments.top.length > 0 && (
                  <Widget title="Most discussed">
                    <ul className="space-y-2 text-sm text-ink-700">
                      {comments.top.map((c) => (
                        <li key={c.snapshotId} className="flex items-center justify-between gap-3">
                          <span className="min-w-0 flex-1 truncate" title={c.name}>
                            {c.name}
                          </span>
                          <span className="tabular-nums">{c.openComments}</span>
                        </li>
                      ))}
                    </ul>
                  </Widget>
                )}
              </Section>

              {/* C6 */}
              <Section
                id="c6"
                title="Rendering configuration"
                info="How snapshots are rendered, and which ones Percy warned about."
              >
                <div className="grid gap-4 sm:grid-cols-4">
                  <StatCard label="JavaScript enabled" value={count(rendering.javascriptEnabled)} hint={`Of ${count(rendering.total)} snapshots`} />
                  <StatCard label="Layout testing" value={count(rendering.layoutEnabled)} hint="enable-layout is on" />
                  <StatCard label="Scoped to a selector" value={count(rendering.withScopeSelector)} hint="Uses a scope selector" />
                  <StatCard label="Layout warnings" value={count(rendering.withLayoutWarning)} hint="Percy reported a warning" />
                </div>
                {rendering.warnings.length > 0 && (
                  <Widget title="Snapshots with warnings">
                    <ul className="space-y-2 text-sm text-ink-700">
                      {rendering.warnings.map((w) => (
                        <li key={w.snapshotId}>
                          <span className="font-medium">{w.name}</span>
                          <span className="text-ink-500"> — {w.warning}</span>
                        </li>
                      ))}
                    </ul>
                  </Widget>
                )}
              </Section>

              {/* C7 */}
              <Section
                id="c7"
                title="Tests producing the most diffs"
                info="Snapshots grouped by the test that created them, with a link to the BrowserStack session when Percy provides one."
              >
                <DataTable columns={testCaseColumns} rows={testCases} rowKey={(r) => r.testCase} empty="Percy did not return test case names for these snapshots." />
              </Section>

              {/* C8 */}
              <Section
                id="c8"
                title="Diff rate by width and browser"
                info="Which viewport width or browser shows the most diffs, to find the breakpoint or browser that regresses most."
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <Widget title="By width">
                    <DataTable columns={rateColumns} rows={responsive.byWidth} rowKey={(r) => r.key} empty="No width data." />
                  </Widget>
                  <Widget title="By browser">
                    <DataTable columns={rateColumns} rows={responsive.byBrowser} rowKey={(r) => r.key} empty="No browser data." />
                  </Widget>
                </div>
              </Section>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}