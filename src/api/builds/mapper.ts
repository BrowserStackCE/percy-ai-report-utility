import { ApiError } from "../errors";
import type {
  Build,
  BuildAi,
  BuildCommit,
  BuildFigma,
  BuildState,
  BuildTimings,
  BuildsPage,
  RawBuild,
  RawBuildsResponse,
  RawResource,
} from "./types";

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const STATES = new Set<BuildState>(["processing", "finished", "failed", "waiting"]);

function stateOf(v: unknown): BuildState {
  const s = typeof v === "string" ? (v.toLowerCase() as BuildState) : "unknown";
  return STATES.has(s) ? s : "unknown";
}

function mapAi(raw: RawBuild["attributes"]): BuildAi | null {
  const a = raw?.["ai-details"];
  if (!isObject(a)) return null;
  return {
    enabled: a["ai-enabled"] === true,
    potentialBugs: num(a["total-potential-bugs"]),
    aiVisualDiffs: num(a["total-ai-visual-diffs"]),
    diffsReduced: num(a["total-diffs-reduced"]),
    diffsReducedCapped: num(a["total-diffs-reduced-capped"]),
    snapshotsWithAi: num(a["total-snapshots-with-ai"]),
    comparisonsWithAi: num(a["total-comparisons-with-ai"]),
    allJobsCompleted: a["all-ai-jobs-completed"] === true,
    summaryStatus: str(a["summary-status"]),
    summaryReason: str(a["summary-reason"]),
    summaryPartialCoverage: a["summary-partial-coverage"] === true,
    remediationStatus: str(a["remediation-status"]),
    remediationReason: str(a["remediation-reason"]),
  };
}

function mapFigma(raw: RawBuild["attributes"]): BuildFigma | null {
  const f = raw?.["figma-details"];
  if (!isObject(f)) return null;
  const fileName = str(f.figma_filename);
  const url = str(f.figma_main_url);
  const flow = str(f.figma_flow_used);
  return fileName || url || flow ? { fileName, url, flow } : null;
}

function mapTimings(raw: RawBuild["attributes"]): BuildTimings | null {
  const t = raw?.["timing-metrics"];
  if (!isObject(t)) return null;
  return {
    queuedSeconds: num(t.queued_duration),
    processingSeconds: num(t.processing_seconds),
    queueWaitAvgSeconds: num(t.queue_wait_avg_seconds),
    queueWaitMaxSeconds: num(t.queue_wait_max_seconds),
  };
}

function lookup(included: RawResource[] | undefined) {
  const byKey = new Map<string, RawResource>();
  for (const r of included ?? []) if (isObject(r)) byKey.set(`${r.type}:${r.id}`, r);
  return byKey;
}

/** Map one raw build. `included` supplies the project name and commit. Returns null when there is no id. */
export function mapBuild(raw: RawBuild, included?: RawResource[]): Build | null {
  if (!raw.id) return null;
  const a = raw.attributes ?? {};
  const res = lookup(included);

  const projectId = raw.relationships?.project?.data?.id ? String(raw.relationships.project.data.id) : null;
  const commitId = raw.relationships?.commit?.data?.id ? String(raw.relationships.commit.data.id) : null;
  const projectRes = projectId ? res.get(`projects:${projectId}`) : undefined;
  const commitRes = commitId ? res.get(`commits:${commitId}`) : undefined;
  const commit: BuildCommit | null = commitRes?.attributes
    ? {
        sha: str(commitRes.attributes.sha),
        message: str(commitRes.attributes.message),
        author: str(commitRes.attributes["author-name"]),
      }
    : null;

  const approverRef = raw.relationships?.["approved-by"]?.data;
  const approverRes = approverRef?.id ? res.get(`${approverRef.type}:${approverRef.id}`) : undefined;
  const approvedBy = str(approverRes?.attributes?.name) ?? str(approverRes?.attributes?.email);

  const shards = a["parallel-total-shards"];
  const errorBuckets = Array.isArray(a["error-buckets"])
    ? a["error-buckets"]
        .map((b) => str(b?.bucket_display_name) ?? str(b?.bucket))
        .filter((b): b is string => b !== null)
    : [];

  return {
    id: String(raw.id),
    projectId,
    projectName: str(projectRes?.attributes?.name),
    buildNumber: num(a["build-number"]),
    branch: str(a.branch),
    type: str(a.type),
    source: str(a.source),
    state: stateOf(a.state),
    reviewState: str(a["review-state"]),
    reviewStateReason: str(a["review-state-reason"]),
    partial: a.partial === true,
    isPullRequest: a["is-pull-request"] === true,
    pullRequestNumber: num(a["pull-request-number"]),
    pullRequestTitle: str(a["pull-request-title"]),
    pullRequestUrl: str(a["pull-request-html-url"]),
    commit,
    commitUrl: str(a["commit-html-url"]),
    branchUrl: str(a["branch-html-url"]),
    userAgent: str(a["user-agent"]),
    isLatestOnBranch: a["is-latest-on-branch"] === true,
    differentBaseBuild: a["different-base-build"] === true,
    totalSnapshots: num(a["total-snapshots"]),
    unreviewedSnapshots: num(a["total-snapshots-unreviewed"]),
    snapshotsRequestingChanges: num(a["total-snapshots-requesting-changes"]),
    rejectedSnapshots: num(a["total-snapshots-rejected"]),
    failedSnapshots: num(a["failed-snapshots-count"]),
    totalComparisons: num(a["total-comparisons"]),
    comparisonsFinished: num(a["total-comparisons-finished"]),
    comparisonsWithDiffs: num(a["total-comparisons-diff"]),
    openComments: num(a["total-open-comments"]),
    testCases: num(a["total-test-cases"]),
    testCasesUnreviewed: num(a["total-test-cases-unreviewed"]),
    testCasesFailed: num(a["total-test-cases-failed"]),
    testhubBuildUuid: str(a["testhub-build-uuid"]),
    smartSnapSkipped: num(a["total-comparisons-skipped-by-smartsnap"]),
    openIssues: num(a["total-open-issues"]),
    hasPartialResults: a["has-partial-results"] === true,
    skipBaseBranchProcessing: a["skip-base-branch-processing"] === true,
    skipBaseBranchProcessingAllowed: a["skip-base-branch-processing-allowed"] === true,
    selfApprovalBlocked: a["self-approval-blocked"] === true,
    prodBuild: a["prod-build"] === true,
    designBuild: a["design-build"] === true,
    snapshotApproved: a["snapshot-approved"] === true,
    actionReasons: str(a["action-reasons"]),
    actionReasonsComment: str(a["action-reasons-comment"]),
    latestActionAt: str(a["latest-action-performed-at"]),
    rejectionReason: str(a["rejection-reason"]),
    approvedBy,
    failedBy: str(a["failed-by"]),
    failedType: str(a["failed-type"]),
    manuallyFailedReason: str(a["manually-failed-reason"]),
    featureInteractions: Array.isArray(a["state-changing-feature-interactions"])
      ? a["state-changing-feature-interactions"].filter((x): x is string => typeof x === "string" && x !== "")
      : [],
    figma: mapFigma(a),
    failureReason: str(a["failure-reason"]),
    failureDetails: str(a["failure-details"]),
    errorBuckets,
    parallelNonce: str(a["parallel-nonce"]),
    parallelShards: shards === null || shards === undefined ? null : str(String(shards)),
    createdAt: str(a["created-at"]),
    finalizedAt: str(a["finalized-at"]),
    finishedAt: str(a["finished-at"]),
    approvedAt: str(a["approved-at"]),
    updatedAt: str(a["updated-at"]),
    processingSeconds: num(a["percy-processing-duration"]),
    buildProcessingSeconds: num(a["build-processing-duration"]),
    buildCountForAverage: num(a["build-count-for-average"]),
    cliStartedAt: str(a["cli-start-time"]),
    medianProcessingSeconds: num(a["median-processing-duration"]),
    averageSeconds: num(a["average-duration"]),
    timings: mapTimings(a),
    ai: mapAi(a),
    percyUrl: str(a["web-url"]),
  };
}

/** Page size Percy allows for GET /builds (also its default and its cap). */
export const BUILDS_PAGE_SIZE = 30;

/** Validate and map a GET /builds response. Throws ApiError("invalid_response") on a wrong shape. */
export function parseBuildsResponse(json: unknown): BuildsPage {
  if (!isObject(json) || !Array.isArray((json as unknown as RawBuildsResponse).data)) {
    throw new ApiError("invalid_response", "Percy returned an unexpected response while loading builds.");
  }
  const body = json as unknown as RawBuildsResponse;
  const included = Array.isArray(body.included) ? body.included : undefined;
  const builds: Build[] = [];
  for (const raw of body.data) {
    const mapped = isObject(raw) ? mapBuild(raw as unknown as RawBuild, included) : null;
    if (mapped) builds.push(mapped);
  }
  // Percy paginates builds by "ids lower than the cursor", so a full page means there may be more.
  const last = builds[builds.length - 1];
  const nextCursor = builds.length >= BUILDS_PAGE_SIZE && last ? Number(last.id) : null;
  return { builds, nextCursor: nextCursor !== null && Number.isFinite(nextCursor) ? nextCursor : null };
}

/** Validate and map a GET /builds/:id response (a single resource). */
export function parseBuildResponse(json: unknown): Build {
  if (!isObject(json) || !isObject(json.data) || Array.isArray(json.data)) {
    throw new ApiError("invalid_response", "Percy returned an unexpected response while loading the build.");
  }
  const included = Array.isArray(json.included) ? (json.included as RawResource[]) : undefined;
  const mapped = mapBuild(json.data as unknown as RawBuild, included);
  if (!mapped) throw new ApiError("invalid_response", "Percy returned a build without an id.");
  return mapped;
}
