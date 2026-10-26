import { ApiError } from "../errors";
import type {
  RawResource,
  RawSnapshot,
  RawSnapshotsResponse,
  Snapshot,
  SnapshotAi,
  SnapshotComparison,
  SnapshotDevice,
  SnapshotReviewState,
  SnapshotsPage,
} from "./types";

const str = (v: unknown): string | null => {
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return typeof v === "string" && v.trim() !== "" ? v : null;
};
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Page size Percy allows for GET /snapshots (also its default and its cap). */
export const SNAPSHOTS_PAGE_SIZE = 30;

const REVIEW_STATES = new Set<SnapshotReviewState>(["unreviewed", "approved", "changes_requested", "merged", "rejected"]);

function reviewStateOf(v: unknown): SnapshotReviewState {
  const s = typeof v === "string" ? (v.toLowerCase().replace(/-/g, "_") as SnapshotReviewState) : "unknown";
  return REVIEW_STATES.has(s) ? s : "unknown";
}

function byKey(included: RawResource[] | undefined) {
  const map = new Map<string, RawResource>();
  for (const r of included ?? []) if (isObject(r)) map.set(`${r.type}:${r.id}`, r);
  return map;
}

function relId(rel: unknown): string | null {
  if (!isObject(rel) || !isObject(rel.data)) return null;
  const id = rel.data.id;
  return id === undefined || id === null ? null : String(id);
}

function mapAi(a: Record<string, unknown>): SnapshotAi | null {
  const d = a["ai-details"];
  if (!isObject(d)) return null;
  return {
    enabled: d["ai-enabled"] === true,
    visualDiffs: num(d["ai-visual-diffs"]),
    processingStatus: str(d["ai-processing-status"]),
    summary: str(d["ai-summary"]),
  };
}

function mapDevice(tag: RawResource | undefined): SnapshotDevice | null {
  const a = tag?.attributes;
  if (!a) return null;
  return {
    name: str(a.name),
    osName: str(a["os-name"]),
    osVersion: str(a["os-version"]),
    browserName: str(a["browser-name"]),
    browserVersion: str(a["browser-version"]),
    orientation: str(a.orientation),
    resolution: str(a.resolution),
  };
}

function mapComparison(raw: RawResource, res: Map<string, RawResource>): SnapshotComparison | null {
  if (raw.id === undefined || raw.id === null) return null;
  const a = raw.attributes ?? {};
  const rels = (raw.relationships ?? {}) as Record<string, unknown>;

  // comparison -> head-screenshot -> image (url, width, height)
  const screenshotId = relId(rels["head-screenshot"]);
  const screenshot = screenshotId ? res.get(`screenshots:${screenshotId}`) : undefined;
  const imageId = relId((screenshot?.relationships ?? {})["image"]);
  const image = imageId ? res.get(`images:${imageId}`) : undefined;
  const tagId = relId(rels["comparison-tag"]);

  return {
    id: String(raw.id),
    state: str(a.state),
    width: num(a.width),
    diffRatio: num(a["diff-ratio"]),
    aiDiffRatio: num(a["ai-diff-ratio"]),
    aiProcessingState: str(a["ai-processing-state"]),
    aiFailureReason: str(a["ai-failure-reason"]),
    recurringDiffStatus: str(a["recurring-diff-detection-status"]),
    ai: mapAi(a),
    externalDebugUrl: str(a["external-debug-url"]),
    imageUrl: str(image?.attributes?.url),
    imageWidth: num(image?.attributes?.width),
    imageHeight: num(image?.attributes?.height),
    device: mapDevice(tagId ? res.get(`comparison-tags:${tagId}`) : undefined),
  };
}

/** Map one raw snapshot. `included` supplies its comparisons, screenshots, images and device tags. */
export function mapSnapshot(raw: RawSnapshot, included?: RawResource[]): Snapshot | null {
  if (raw.id === undefined || raw.id === null || raw.id === "") return null;
  const a = (raw.attributes ?? {}) as Record<string, unknown>;
  const res = byKey(included);

  const cmpData = raw.relationships?.comparisons?.data;
  const refs = Array.isArray(cmpData) ? cmpData : [];
  const comparisons: SnapshotComparison[] = [];
  for (const ref of refs) {
    const full = ref?.id !== undefined ? res.get(`comparisons:${ref.id}`) : undefined;
    const mapped = full ? mapComparison(full, res) : null;
    if (mapped) comparisons.push(mapped);
  }

  const layoutWarning = a["layout-warning"];
  const name = str(a.name) ?? `Snapshot ${raw.id}`;

  return {
    id: String(raw.id),
    buildId: relId(raw.relationships?.build),
    name,
    displayName: str(a["display-name"]),
    reviewState: reviewStateOf(a["review-state"]),
    reviewStateReason: str(a["review-state-reason"]),
    fingerprint: str(a.fingerprint),
    openComments: num(a["total-open-comments"]),
    isReintroduced: a["is-reintroduced"] === true,
    enableJavascript: a["enable-javascript"] === true,
    enableLayout: a["enable-layout"] === true,
    layoutWarning: typeof layoutWarning === "string" ? str(layoutWarning) : str(a["renderer-layout-warning-text"]),
    scopeSelector: str(a["scope-selector"]),
    testCaseId: str(a["test-case-id"]),
    testCaseName: str(a["test-case-name"]),
    comparisons,
  };
}

const BAD_SNAPSHOT = "Percy returned an unexpected response while loading the snapshot.";

/**
 * Validate and map a GET /snapshots/:id response, where `data` is one object rather than a list.
 * Throws ApiError("invalid_response") on a wrong shape.
 */
export function parseSnapshotResponse(json: unknown): Snapshot {
  if (!isObject(json) || !isObject(json.data)) throw new ApiError("invalid_response", BAD_SNAPSHOT);
  const included = Array.isArray(json.included) ? (json.included as RawResource[]) : undefined;
  const mapped = mapSnapshot(json.data as RawSnapshot, included);
  if (!mapped) throw new ApiError("invalid_response", BAD_SNAPSHOT);
  return mapped;
}

/** Validate and map a GET /snapshots response. Throws ApiError("invalid_response") on a wrong shape. */
export function parseSnapshotsResponse(json: unknown): SnapshotsPage {
  if (!isObject(json) || !Array.isArray((json as unknown as RawSnapshotsResponse).data)) {
    throw new ApiError("invalid_response", "Percy returned an unexpected response while loading snapshots.");
  }
  const body = json as unknown as RawSnapshotsResponse;
  const included = Array.isArray(body.included) ? body.included : undefined;
  const snapshots: Snapshot[] = [];
  for (const raw of body.data) {
    const mapped = isObject(raw) ? mapSnapshot(raw as RawSnapshot, included) : null;
    if (mapped) snapshots.push(mapped);
  }
  // Percy pages snapshots by "ids after the cursor", so a full page means there may be more.
  const last = snapshots[snapshots.length - 1];
  const nextCursor = body.data.length >= SNAPSHOTS_PAGE_SIZE && last ? Number(last.id) : null;
  return { snapshots, nextCursor: nextCursor !== null && Number.isFinite(nextCursor) ? nextCursor : null };
}