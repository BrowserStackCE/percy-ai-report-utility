// Raw JSON:API shapes returned by GET /snapshots, limited to the fields we read.
// Every attribute is optional/nullable: the mapper must not trust any of them to be present.

export interface RawRelationshipRef {
  data?: { type?: string; id?: string | number } | null;
}

export interface RawSnapshotAttributes {
  name?: string | null;
  "display-name"?: string | null;
  "review-state"?: string | null;
  "review-state-reason"?: string | null;
  fingerprint?: string | number | null;
  "total-open-comments"?: number | null;
  "is-reintroduced"?: boolean;
  "enable-javascript"?: boolean;
  "enable-layout"?: boolean;
  "layout-warning"?: boolean | string | null;
  "renderer-layout-warning-text"?: string | null;
  "scope-selector"?: string | boolean | null;
  "test-case-id"?: string | number | null;
  "test-case-name"?: string | null;
}

export interface RawResource {
  type?: string;
  id?: string | number;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, unknown>;
}

export interface RawSnapshot extends RawResource {
  attributes?: RawSnapshotAttributes & Record<string, unknown>;
  relationships?: {
    build?: RawRelationshipRef;
    comparisons?: { data?: Array<{ type?: string; id?: string | number }> | null };
  } & Record<string, unknown>;
}

export interface RawSnapshotsResponse {
  data: RawSnapshot[];
  included?: RawResource[];
}

// ---- Mapped (what the UI reads) ----

export type SnapshotReviewState = "unreviewed" | "approved" | "changes_requested" | "merged" | "rejected" | "unknown";

/** One change Percy AI found on a comparison (an entry of `applied-regions`). */
export interface SnapshotAiFinding {
  title: string | null;
  description: string | null;
  reason: string | null;
  changeType: string | null;
  /** True when the AI judged the change noise and ignored it. */
  ignored: boolean;
}

export interface SnapshotAi {
  enabled: boolean;
  visualDiffs: number | null;
  processingStatus: string | null;
  /** Titles of the kept changes joined into one line. */
  summary: string | null;
  /** Every change the AI reported, with its full text. */
  findings: SnapshotAiFinding[];
}

export interface SnapshotDevice {
  name: string | null;
  osName: string | null;
  osVersion: string | null;
  browserName: string | null;
  browserVersion: string | null;
  orientation: string | null;
  resolution: string | null;
}

export interface SnapshotComparison {
  id: string;
  state: string | null;
  width: number | null;
  /** Fraction (0 to 1) of the page that changed; null when Percy has not computed it. */
  diffRatio: number | null;
  /** Fraction (0 to 1) after Percy AI filtered noise; null when AI did not run. */
  aiDiffRatio: number | null;
  aiProcessingState: string | null;
  aiFailureReason: string | null;
  recurringDiffStatus: string | null;
  ai: SnapshotAi | null;
  externalDebugUrl: string | null;
  /** Screenshot of the head (new) build, when Percy returned one. */
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  device: SnapshotDevice | null;
}

export interface Snapshot {
  id: string;
  buildId: string | null;
  name: string;
  displayName: string | null;
  reviewState: SnapshotReviewState;
  reviewStateReason: string | null;
  fingerprint: string | null;
  openComments: number | null;
  isReintroduced: boolean;
  enableJavascript: boolean;
  enableLayout: boolean;
  layoutWarning: string | null;
  scopeSelector: string | null;
  testCaseId: string | null;
  testCaseName: string | null;
  comparisons: SnapshotComparison[];
}

export interface SnapshotsPage {
  snapshots: Snapshot[];
  /** Snapshot id to send as page[cursor] for the next page; null on the last page. */
  nextCursor: number | null;
}

export interface SnapshotFilters {
  /** Matches snapshot names (filter[search]). */
  search?: string;
  /** filter[review-state-reason][]. */
  reviewStateReasons?: string[];
}