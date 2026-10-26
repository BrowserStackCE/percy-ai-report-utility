import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { fetchSnapshotsPage } from "./snapshotsApi";
import type { Snapshot } from "./types";

/** Most pages a report will walk (30 snapshots each). Keeps one report well under Percy's rate limit. */
export const MAX_REPORT_PAGES = 20;

export interface AllSnapshotsState {
  status: "idle" | "loading" | "ready" | "error";
  snapshots: Snapshot[];
  error: ApiError | null;
  /** Pages fetched so far, for a progress caption while the report builds. */
  pagesLoaded: number;
  /** True when the page cap stopped the walk before Percy ran out of snapshots. */
  truncated: boolean;
  reload: () => void;
}

/**
 * Every snapshot of one build, fetched page by page (cursor paging) so a report can total the
 * whole build instead of one page. Results appear as pages arrive. Stops after MAX_REPORT_PAGES.
 */
export function useAllSnapshots(buildId: string): AllSnapshotsState {
  const { credentials } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [status, setStatus] = useState<AllSnapshotsState["status"]>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [nonce, setNonce] = useState(0);

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

    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    (async () => {
      let cursor: number | null = null;
      let all: Snapshot[] = [];
      for (let page = 1; page <= MAX_REPORT_PAGES; page++) {
        const result = await fetchSnapshotsPage({ auth, buildId, cursor, signal: controller.signal });
        all = all.concat(result.snapshots);
        if (controller.signal.aborted) return;
        setSnapshots(all);
        setPagesLoaded(page);
        if (result.nextCursor === null) {
          setStatus("ready");
          return;
        }
        if (page === MAX_REPORT_PAGES) setTruncated(true);
        cursor = result.nextCursor;
      }
      setStatus("ready");
    })().catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading snapshots."));
      setStatus("error");
    });

    return () => controller.abort();
  }, [credentials, buildId, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { status, snapshots, error, pagesLoaded, truncated, reload };
}
