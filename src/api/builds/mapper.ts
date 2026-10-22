import { ApiError } from "../errors";
import type { Build, BuildState, BuildsPage, RawBuild, RawBuildsResponse } from "./types";

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

/** Map one raw build. Returns null when it has no id. */
export function mapBuild(raw: RawBuild): Build | null {
  if (!raw.id) return null;
  const a = raw.attributes ?? {};
  return {
    id: String(raw.id),
    projectId: raw.relationships?.project?.data?.id ? String(raw.relationships.project.data.id) : null,
    buildNumber: num(a["build-number"]),
    branch: str(a.branch),
    state: stateOf(a.state),
    reviewState: str(a["review-state"]),
    isPullRequest: a["is-pull-request"] === true,
    pullRequestNumber: num(a["pull-request-number"]),
    pullRequestTitle: str(a["pull-request-title"]),
    totalSnapshots: num(a["total-snapshots"]),
    unreviewedSnapshots: num(a["total-snapshots-unreviewed"]),
    snapshotsWithDiffs: num(a["total-comparisons-diff"]),
    failedSnapshots: num(a["failed-snapshots-count"]),
    failureReason: str(a["failure-reason"]),
    createdAt: str(a["created-at"]),
    finishedAt: str(a["finished-at"]),
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
  const builds: Build[] = [];
  for (const raw of (json as unknown as RawBuildsResponse).data) {
    const mapped = isObject(raw) ? mapBuild(raw as unknown as RawBuild) : null;
    if (mapped) builds.push(mapped);
  }
  // Percy paginates builds by "ids lower than the cursor", so a full page means there may be more.
  const last = builds[builds.length - 1];
  const nextCursor = builds.length >= BUILDS_PAGE_SIZE && last ? Number(last.id) : null;
  return { builds, nextCursor: nextCursor !== null && Number.isFinite(nextCursor) ? nextCursor : null };
}
