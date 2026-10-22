// Raw JSON:API shapes returned by GET /builds, limited to the fields we read.
// Every attribute is optional/nullable: the mapper must not trust any of them to be present.

export interface RawBuildAttributes {
  branch?: string | null;
  type?: string | null;
  "build-number"?: number | null;
  "web-url"?: string | null;
  state?: string | null;
  "review-state"?: string | null;
  "review-state-reason"?: string | null;
  "is-pull-request"?: boolean;
  "pull-request-number"?: number | null;
  "pull-request-title"?: string | null;
  "total-snapshots"?: number | null;
  "total-snapshots-unreviewed"?: number | null;
  "total-comparisons-diff"?: number | null;
  "failed-snapshots-count"?: number | null;
  "failure-reason"?: string | null;
  "finished-at"?: string | null;
  "created-at"?: string | null;
}

export interface RawBuild {
  type: "builds";
  id: string;
  attributes?: RawBuildAttributes;
  relationships?: {
    project?: { data?: { type: string; id: string } | null };
  };
}

export interface RawBuildsResponse {
  data: RawBuild[];
}

// ---- Domain model ----

export type BuildState = "processing" | "finished" | "failed" | "waiting" | "unknown";

export interface Build {
  id: string;
  projectId: string | null;
  buildNumber: number | null;
  branch: string | null;
  state: BuildState;
  reviewState: string | null;
  isPullRequest: boolean;
  pullRequestNumber: number | null;
  pullRequestTitle: string | null;
  totalSnapshots: number | null;
  unreviewedSnapshots: number | null;
  snapshotsWithDiffs: number | null;
  failedSnapshots: number | null;
  failureReason: string | null;
  createdAt: string | null;
  finishedAt: string | null;
  /** Link to the build on percy.io. */
  percyUrl: string | null;
}

export interface BuildsPage {
  builds: Build[];
  /** Cursor (the last build id) for the next page, or null when this page was the last. */
  nextCursor: number | null;
}
