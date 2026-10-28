// Raw JSON:API shapes returned by GET /builds and GET /builds/:id, limited to the fields we read.
// Every attribute is optional/nullable: Percy returns different sets of attributes per build type,
// and the mapper must not trust any of them to be present.

export interface RawBuildAttributes {
  branch?: string | null;
  type?: string | null;
  source?: string | null;
  "build-number"?: number | null;
  partial?: boolean;
  "web-url"?: string | null;
  "commit-html-url"?: string | null;
  "branch-html-url"?: string | null;
  "pull-request-html-url"?: string | null;
  state?: string | null;
  "review-state"?: string | null;
  "review-state-reason"?: string | null;
  "is-pull-request"?: boolean;
  "pull-request-number"?: number | null;
  "pull-request-title"?: string | null;
  "user-agent"?: string | null;
  "total-snapshots"?: number | null;
  "total-snapshots-requesting-changes"?: number | null;
  "total-snapshots-unreviewed"?: number | null;
  "total-snapshots-rejected"?: number | null;
  "total-comparisons"?: number | null;
  "total-comparisons-finished"?: number | null;
  "total-comparisons-diff"?: number | null;
  "total-open-comments"?: number | null;
  "total-test-cases"?: number | null;
  "failed-snapshots-count"?: number | null;
  "failure-reason"?: string | null;
  "failure-details"?: string | null;
  "parallel-nonce"?: string | null;
  "parallel-total-shards"?: number | string | null;
  "finished-at"?: string | null;
  "finalized-at"?: string | null;
  "approved-at"?: string | null;
  "created-at"?: string | null;
  "updated-at"?: string | null;
  "percy-processing-duration"?: number | null;
  "median-processing-duration"?: number | null;
  "average-duration"?: number | null;
  "is-latest-on-branch"?: boolean;
  "different-base-build"?: boolean;
  // TestHub test cases
  "total-test-cases-unreviewed"?: number | null;
  "total-test-cases-failed"?: number | null;
  "testhub-build-uuid"?: string | null;
  // Processing
  "build-processing-duration"?: number | null;
  "build-count-for-average"?: number | null;
  "cli-start-time"?: string | null;
  // Flags and counters
  "has-partial-results"?: boolean;
  "skip-base-branch-processing"?: boolean;
  "skip-base-branch-processing-allowed"?: boolean;
  "self-approval-blocked"?: boolean;
  "prod-build"?: boolean;
  "design-build"?: boolean;
  "snapshot-approved"?: boolean;
  "total-comparisons-skipped-by-smartsnap"?: number | null;
  "total-open-issues"?: number | null;
  // Actions and failure
  "action-reasons"?: string | null;
  "action-reasons-comment"?: string | null;
  "latest-action-performed-at"?: string | null;
  "failed-by"?: string | null;
  "failed-type"?: string | null;
  "manually-failed-reason"?: string | null;
  "rejection-reason"?: string | null;
  "state-changing-feature-interactions"?: string[] | null;
  "figma-details"?: {
    figma_filename?: string | null;
    figma_main_url?: string | null;
    figma_flow_used?: string | null;
  } | null;
  "ai-details"?: {
    "ai-enabled"?: boolean;
    "total-diffs-reduced"?: number | null;
    "total-diffs-reduced-capped"?: number | null;
    "total-snapshots-with-ai"?: number | null;
    "total-comparisons-with-ai"?: number | null;
    "total-potential-bugs"?: number | null;
    "total-ai-visual-diffs"?: number | null;
    "all-ai-jobs-completed"?: boolean;
    "summary-status"?: string | null;
    "summary-reason"?: string | null;
    "summary-partial-coverage"?: boolean;
    "remediation-status"?: string | null;
    "remediation-reason"?: string | null;
  } | null;
  "timing-metrics"?: {
    queued_duration?: number | null;
    processing_seconds?: number | null;
    queue_wait_avg_seconds?: number | null;
    queue_wait_max_seconds?: number | null;
  } | null;
  "error-buckets"?: { bucket?: string; bucket_display_name?: string }[] | null;
}

export interface RawResource {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
}

export interface RawBuild {
  type: "builds";
  id: string;
  attributes?: RawBuildAttributes;
  relationships?: {
    project?: { data?: { type: string; id: string } | null };
    commit?: { data?: { type: string; id: string } | null };
    "approved-by"?: { data?: { type: string; id: string } | null };
  };
}

export interface RawBuildsResponse {
  data: RawBuild[];
  included?: RawResource[];
}

// ---- Domain model ----

export type BuildState = "processing" | "finished" | "failed" | "waiting" | "unknown";

export interface BuildCommit {
  sha: string | null;
  message: string | null;
  author: string | null;
}

export interface BuildAi {
  enabled: boolean;
  potentialBugs: number | null;
  aiVisualDiffs: number | null;
  diffsReduced: number | null;
  diffsReducedCapped: number | null;
  snapshotsWithAi: number | null;
  comparisonsWithAi: number | null;
  allJobsCompleted: boolean;
  summaryStatus: string | null;
  summaryReason: string | null;
  summaryPartialCoverage: boolean;
  remediationStatus: string | null;
  remediationReason: string | null;
}

export interface BuildFigma {
  fileName: string | null;
  url: string | null;
  flow: string | null;
}

export interface BuildTimings {
  queuedSeconds: number | null;
  processingSeconds: number | null;
  queueWaitAvgSeconds: number | null;
  queueWaitMaxSeconds: number | null;
}

export interface Build {
  id: string;
  projectId: string | null;
  projectName: string | null;
  buildNumber: number | null;
  branch: string | null;
  type: string | null;
  source: string | null;
  state: BuildState;
  reviewState: string | null;
  reviewStateReason: string | null;
  partial: boolean;
  isPullRequest: boolean;
  pullRequestNumber: number | null;
  pullRequestTitle: string | null;
  pullRequestUrl: string | null;
  commit: BuildCommit | null;
  commitUrl: string | null;
  branchUrl: string | null;
  userAgent: string | null;
  isLatestOnBranch: boolean;
  differentBaseBuild: boolean;
  // Snapshot / comparison counters
  totalSnapshots: number | null;
  unreviewedSnapshots: number | null;
  snapshotsRequestingChanges: number | null;
  rejectedSnapshots: number | null;
  failedSnapshots: number | null;
  totalComparisons: number | null;
  comparisonsFinished: number | null;
  comparisonsWithDiffs: number | null;
  openComments: number | null;
  testCases: number | null;
  testCasesUnreviewed: number | null;
  testCasesFailed: number | null;
  testhubBuildUuid: string | null;
  smartSnapSkipped: number | null;
  openIssues: number | null;
  // Flags
  hasPartialResults: boolean;
  skipBaseBranchProcessing: boolean;
  skipBaseBranchProcessingAllowed: boolean;
  selfApprovalBlocked: boolean;
  prodBuild: boolean;
  designBuild: boolean;
  snapshotApproved: boolean;
  // Actions
  actionReasons: string | null;
  actionReasonsComment: string | null;
  latestActionAt: string | null;
  rejectionReason: string | null;
  /** Name of the person who approved the build, when Percy includes the approver in `included`. */
  approvedBy: string | null;
  failedBy: string | null;
  failedType: string | null;
  manuallyFailedReason: string | null;
  featureInteractions: string[];
  figma: BuildFigma | null;
  // Failure
  failureReason: string | null;
  failureDetails: string | null;
  errorBuckets: string[];
  // Parallel
  parallelNonce: string | null;
  parallelShards: string | null;
  // Timing
  createdAt: string | null;
  finalizedAt: string | null;
  finishedAt: string | null;
  approvedAt: string | null;
  updatedAt: string | null;
  processingSeconds: number | null;
  buildProcessingSeconds: number | null;
  buildCountForAverage: number | null;
  cliStartedAt: string | null;
  medianProcessingSeconds: number | null;
  averageSeconds: number | null;
  timings: BuildTimings | null;
  ai: BuildAi | null;
  /** Link to the build on percy.io (shown only as a secondary action). */
  percyUrl: string | null;
}

export interface BuildsPage {
  builds: Build[];
  /** Cursor (the last build id) for the next page, or null when this page was the last. */
  nextCursor: number | null;
}

/** Filters Percy supports on GET /builds. */
export interface BuildFilters {
  branch?: string;
  /** One of processing, finished, failed, waiting. */
  state?: string;
  sha?: string;
}
