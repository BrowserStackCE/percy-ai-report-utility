import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { fetchSnapshotsPage } from "./snapshotsApi";
import type { Snapshot, SnapshotFilters } from "./types";

export interface SnapshotsState {
  status: "idle" | "loading" | "ready" | "error";
  snapshots: Snapshot[];
  error: ApiError | null;
  /** 1-based page currently shown. */
  page: number;
  hasNext: boolean;
  hasPrev: boolean;
  loadingPage: boolean;
  next: () => void;
  prev: () => void;
  reload: () => void;
}

/**
 * Snapshots of one build, one Percy page (30) at a time. Percy pages with a cursor (the last snapshot
 * id of the previous page), so earlier cursors are remembered to let the user go back.
 */
export function useSnapshots(buildId: string, filters: SnapshotFilters = {}): SnapshotsState {
  const { credentials } = useAuth();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [status, setStatus] = useState<SnapshotsState["status"]>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  // cursors[i] is the cursor used to load page i+1 (null for the first page).
  const [cursors, setCursors] = useState<(number | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const { search } = filters;
  // A stable string key keeps the effect from re-running on every new array identity.
  const reasonsKey = (filters.reviewStateReasons ?? []).join(",");

  // A new build, new filters or an explicit reload start again from the first page.
  useEffect(() => {
    setCursors([null]);
    setPageIndex(0);
  }, [buildId, search, reasonsKey, nonce]);

  const cursor = cursors[pageIndex] ?? null;

  useEffect(() => {
    if (!buildId) {
      setSnapshots([]);
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
    setStatus((s) => (s === "ready" ? s : "loading"));
    setError(null);
    fetchSnapshotsPage({
      auth,
      buildId,
      cursor,
      filters: { search, reviewStateReasons: reasonsKey ? reasonsKey.split(",") : undefined },
      signal: controller.signal,
    })
      .then((p) => {
        setSnapshots(p.snapshots);
        setNextCursor(p.nextCursor);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading snapshots."));
        setStatus("error");
      });
    return () => controller.abort();
  }, [credentials, buildId, cursor, search, reasonsKey, nonce]);

  const next = useCallback(() => {
    if (nextCursor === null) return;
    setCursors((prev) => [...prev.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((i) => i + 1);
  }, [nextCursor, pageIndex]);

  const prev = useCallback(() => setPageIndex((i) => Math.max(0, i - 1)), []);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    status,
    snapshots,
    error,
    page: pageIndex + 1,
    hasNext: nextCursor !== null,
    hasPrev: pageIndex > 0,
    loadingPage: status === "loading",
    next,
    prev,
    reload,
  };
}