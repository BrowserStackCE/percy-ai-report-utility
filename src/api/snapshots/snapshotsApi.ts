import { percyGet, type Auth } from "../http";
import { SNAPSHOTS_PAGE_SIZE, parseSnapshotResponse, parseSnapshotsResponse } from "./mapper";
import type { Snapshot, SnapshotFilters, SnapshotsPage } from "./types";

export interface ListSnapshotsOptions {
  auth: Auth;
  buildId: string;
  /** Snapshot id of the last snapshot on the previous page. */
  cursor?: number | null;
  filters?: SnapshotFilters;
  signal?: AbortSignal;
}

/** Fetch one page (up to 30) of a build's snapshots, with their comparisons and screenshots. */
export async function fetchSnapshotsPage({ auth, buildId, cursor, filters, signal }: ListSnapshotsOptions): Promise<SnapshotsPage> {
  const reasons = (filters?.reviewStateReasons ?? []).map((r) => r.trim()).filter(Boolean);
  const json = await percyGet("/snapshots", {
    auth,
    signal,
    query: {
      build_id: buildId,
      "page[limit]": SNAPSHOTS_PAGE_SIZE,
      "page[cursor]": cursor ?? undefined,
      "filter[search]": filters?.search?.trim() || undefined,
      // Percy reads repeated `filter[review-state-reason][]` keys as one array.
      "filter[review-state-reason][]": reasons.length > 0 ? reasons : undefined,
    },
  });
  return parseSnapshotsResponse(json);
}

/** Fetch one snapshot with its comparisons, screenshots and device tags (GET /snapshots/:id). */
export async function fetchSnapshot(snapshotId: string, { auth, signal }: { auth: Auth; signal?: AbortSignal }): Promise<Snapshot> {
  const json = await percyGet(`/snapshots/${encodeURIComponent(snapshotId)}`, { auth, signal });
  return parseSnapshotResponse(json);
}