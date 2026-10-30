import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { cacheKey, onDataCacheCleared, readCache, writeCache } from "../dataCache";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { fetchSnapshotsPage } from "./snapshotsApi";
import { SNAPSHOTS_PAGE_SIZE } from "./mapper";
import type { Snapshot } from "./types";

/** Most snapshots one report will load. At 30 per page that is 67 pages, so large builds are covered too. */
export const MAX_REPORT_SNAPSHOTS = 2000;
/** Most pages a report will walk (30 snapshots each). */
export const MAX_REPORT_PAGES = Math.ceil(MAX_REPORT_SNAPSHOTS / SNAPSHOTS_PAGE_SIZE);

export interface AllSnapshotsState {
  status: "idle" | "loading" | "ready" | "error";
  snapshots: Snapshot[];
  error: ApiError | null;
  /** Pages fetched so far, for a progress caption while the report builds. */
  pagesLoaded: number;
  /** True when the snapshot cap stopped the walk before Percy ran out of snapshots. */
  truncated: boolean;
  /** Snapshots the build is expected to have, used for a progress bar. 0 when unknown. */
  expectedTotal: number;
  reload: () => void;
}

interface CachedSnapshots {
  snapshots: Snapshot[];
  pagesLoaded: number;
  truncated: boolean;
}

/**
 * Every snapshot of one build, fetched page by page (cursor paging) so a report can total the
 * whole build instead of one page. Results appear as pages arrive. Stops at MAX_REPORT_SNAPSHOTS.
 * A completed walk is cached, so coming back to the report does not call Percy again; a hot reload
 * clears the cache and loads it fresh.
 *
 * `expectedTotal` (the build's snapshot count) only drives the progress bar.
 */
export function useAllSnapshots(buildId: string, expectedTotal = 0): AllSnapshotsState {
  const { credentials } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [status, setStatus] = useState<AllSnapshotsState["status"]>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [nonce, setNonce] = useState(0);

  // A hot reload clears the cache; refetch whatever is on screen.
  useEffect(() => onDataCacheCleared(() => setNonce((n) => n + 1)), []);

  useEffect(() => {
    setSnapshots([]);
    setPagesLoaded(0);
    setTruncated(false);
    if (!buildId) {
      setStatus("idle");
      setError(null);
      return;
    }
    const auth = authFromCredentials(credentials);
    if (!auth) {
      setStatus("error");
      setError(new ApiError("not_authenticated", "You are not signed in.", { hint: "Sign in to load snapshots." }));
      return;
    }

    const key = cacheKey("all-snapshots", buildId);
    const cached = readCache<CachedSnapshots>(key);
    if (cached) {
      setSnapshots(cached.snapshots);
      setPagesLoaded(cached.pagesLoaded);
      setTruncated(cached.truncated);
      setError(null);
      setStatus("ready");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    (async () => {
      let cursor: number | null = null;
      let all: Snapshot[] = [];
      let cut = false;
      let pages = 0;
      for (let page = 1; page <= MAX_REPORT_PAGES; page++) {
        const result = await fetchSnapshotsPage({ auth, buildId, cursor, signal: controller.signal });
        if (controller.signal.aborted) return;
        all = all.concat(result.snapshots);
        pages = page;
        setSnapshots(all);
        setPagesLoaded(page);
        if (result.nextCursor === null) break;
        if (page === MAX_REPORT_PAGES) cut = true;
        cursor = result.nextCursor;
      }
      setTruncated(cut);
      writeCache<CachedSnapshots>(key, { snapshots: all, pagesLoaded: pages, truncated: cut });
      setStatus("ready");
    })().catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading snapshots."));
      setStatus("error");
    });

    return () => controller.abort();
  }, [credentials, buildId, nonce]);

  const reload = useCallback(() => {
    // Retry after an error: drop this build's entry and walk again.
    setNonce((n) => n + 1);
  }, []);

  return { status, snapshots, error, pagesLoaded, truncated, expectedTotal, reload };
}
