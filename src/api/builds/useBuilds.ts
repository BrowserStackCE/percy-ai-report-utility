import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { fetchBuildsPage } from "./buildsApi";
import type { Build } from "./types";

export interface BuildsState {
  status: "idle" | "loading" | "ready" | "error";
  builds: Build[];
  error: ApiError | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

/** Recent builds (last 30 days) of one project. Idle until a project is chosen. */
export function useBuilds(projectId: string): BuildsState {
  const { credentials } = useAuth();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [status, setStatus] = useState<BuildsState["status"]>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    setBuilds([]);
    setCursor(null);
    setError(null);
    if (!projectId) {
      setStatus("idle");
      return;
    }
    const auth = authFromCredentials(credentials);
    if (!auth) {
      setStatus("error");
      setError(new ApiError("not_authenticated", "You are not signed in.", { hint: "Sign in to load builds." }));
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    fetchBuildsPage({ auth, projectId, signal: controller.signal })
      .then((page) => {
        setBuilds(page.builds);
        setCursor(page.nextCursor);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading builds."));
        setStatus("error");
      });
    return () => controller.abort();
  }, [credentials, projectId, nonce]);

  const loadMore = useCallback(() => {
    const auth = authFromCredentials(credentials);
    if (!auth || !projectId || cursor === null || loadingMore) return;
    setLoadingMore(true);
    fetchBuildsPage({ auth, projectId, cursor })
      .then((page) => {
        setBuilds((prev) => {
          const seen = new Set(prev.map((b) => b.id));
          return [...prev, ...page.builds.filter((b) => !seen.has(b.id))];
        });
        setCursor(page.nextCursor);
      })
      .catch((err: unknown) => {
        setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading builds."));
      })
      .finally(() => setLoadingMore(false));
  }, [credentials, projectId, cursor, loadingMore]);

  return { status, builds, error, hasMore: cursor !== null, loadingMore, loadMore, reload };
}
