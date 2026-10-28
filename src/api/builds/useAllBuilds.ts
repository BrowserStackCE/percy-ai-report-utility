import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { fetchBuildsPage } from "./buildsApi";
import type { Build } from "./types";

/** Safety cap: 10 pages x 30 builds. Keeps the analytics page well inside Percy's read rate limit. */
export const MAX_ANALYTICS_PAGES = 10;

export interface AllBuildsState {
  status: "idle" | "loading" | "ready" | "error";
  builds: Build[];
  error: ApiError | null;
  /** True when the page cap was hit and older builds in the 30-day window were not loaded. */
  truncated: boolean;
  pagesLoaded: number;
  reload: () => void;
}

/**
 * Every build of a project in Percy's 30-day window, loaded page by page (cursor = last build id).
 * Used by the Analytics page, which aggregates across builds instead of listing one page.
 */
export function useAllBuilds(projectId: string): AllBuildsState {
  const { credentials } = useAuth();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [status, setStatus] = useState<AllBuildsState["status"]>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

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
    setStatus("loading");
    setError(null);
    setTruncated(false);
    setPagesLoaded(0);
    setBuilds([]);

    (async () => {
      const all: Build[] = [];
      let cursor: number | null = null;
      for (let page = 1; page <= MAX_ANALYTICS_PAGES; page += 1) {
        const res = await fetchBuildsPage({ auth, projectId, cursor, signal: controller.signal });
        all.push(...res.builds);
        setBuilds([...all]);
        setPagesLoaded(page);
        if (res.nextCursor === null) {
          setStatus("ready");
          return;
        }
        cursor = res.nextCursor;
      }
      setTruncated(true);
      setStatus("ready");
    })().catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading builds."));
      setStatus("error");
    });

    return () => controller.abort();
  }, [credentials, projectId, nonce]);

  return { status, builds, error, truncated, pagesLoaded, reload };
}
