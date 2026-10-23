import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { fetchBuildsPage } from "./buildsApi";
import type { Build, BuildFilters } from "./types";

export interface BuildsState {
  status: "idle" | "loading" | "ready" | "error";
  builds: Build[];
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
 * Recent builds (last 30 days) of one project, one Percy page (30) at a time.
 * Percy pages builds with a cursor (the last build id of the previous page), so earlier cursors are
 * remembered to let the user go back. Idle until a project is chosen; filters are applied server-side.
 */
export function useBuilds(projectId: string, filters: BuildFilters = {}): BuildsState {
  const { credentials } = useAuth();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [status, setStatus] = useState<BuildsState["status"]>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  // cursors[i] is the cursor used to load page i+1 (null for the first page).
  const [cursors, setCursors] = useState<(number | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const { branch, state, sha } = filters;

  // A new project, new filters or an explicit reload start again from the first page.
  useEffect(() => {
    setCursors([null]);
    setPageIndex(0);
  }, [projectId, branch, state, sha, nonce]);

  const cursor = cursors[pageIndex] ?? null;

  useEffect(() => {
    if (!projectId) {
      setBuilds([]);
      setStatus("idle");
      setError(null);
      return;
    }
    const auth = authFromCredentials(credentials);
    if (!auth) {
      setStatus("error");
      setError(new ApiError("not_authenticated", "You are not signed in.", { hint: "Sign in to load builds." }));
      return;
    }

    const controller = new AbortController();
    setStatus((s) => (s === "ready" ? s : "loading"));
    setError(null);
    fetchBuildsPage({ auth, projectId, cursor, filters: { branch, state, sha }, signal: controller.signal })
      .then((page) => {
        setBuilds(page.builds);
        setNextCursor(page.nextCursor);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading builds."));
        setStatus("error");
      });
    return () => controller.abort();
  }, [credentials, projectId, cursor, branch, state, sha, nonce]);

  const next = useCallback(() => {
    if (nextCursor === null) return;
    setCursors((prev) => {
      const copy = prev.slice(0, pageIndex + 1);
      copy.push(nextCursor);
      return copy;
    });
    setPageIndex((i) => i + 1);
  }, [nextCursor, pageIndex]);

  const prev = useCallback(() => setPageIndex((i) => Math.max(0, i - 1)), []);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    status,
    builds,
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
