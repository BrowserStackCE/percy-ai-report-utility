import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { cacheKey, onDataCacheCleared, readCache, writeCache } from "../dataCache";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { fetchBuildsPage } from "./buildsApi";
import { BUILDS_PAGE_SIZE } from "./mapper";
import type { Build } from "./types";

/** Most builds an analytics report may include. */
export const MAX_ANALYTICS_BUILDS = 10;
/** Build counts offered in the filter. */
export const BUILD_COUNT_OPTIONS = [3, 5, 10] as const;
export const DEFAULT_ANALYTICS_BUILDS = 10;

/** Pages needed to cover the build limit (30 builds per page), used when more than one is required. */
const pagesFor = (limit: number) => Math.max(1, Math.ceil(limit / BUILDS_PAGE_SIZE));

export interface AllBuildsState {
  status: "idle" | "loading" | "ready" | "error";
  builds: Build[];
  error: ApiError | null;
  /** True when more builds exist in the 30-day window than the chosen limit. */
  truncated: boolean;
  pagesLoaded: number;
  reload: () => void;
}

interface CachedBuilds {
  builds: Build[];
  truncated: boolean;
  pagesLoaded: number;
}

/**
 * The newest builds of a project in Percy's 30-day window, up to `limit` (max 10), loaded page by page
 * (cursor = last build id). Used by the Analytics page, which aggregates across builds.
 * A completed load is cached per project and limit; a hot reload clears it.
 */
export function useAllBuilds(projectId: string, limit: number = DEFAULT_ANALYTICS_BUILDS): AllBuildsState {
  const cap = Math.min(Math.max(1, limit), MAX_ANALYTICS_BUILDS);
  const { credentials } = useAuth();
  const [builds, setBuilds] = useState<Build[]>([]);
  const [status, setStatus] = useState<AllBuildsState["status"]>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => onDataCacheCleared(() => setNonce((n) => n + 1)), []);

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

    const key = cacheKey("analytics-builds", projectId, cap);
    const cached = readCache<CachedBuilds>(key);
    if (cached) {
      setBuilds(cached.builds);
      setTruncated(cached.truncated);
      setPagesLoaded(cached.pagesLoaded);
      setError(null);
      setStatus("ready");
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
      let more = false;
      let pages = 0;
      for (let page = 1; page <= pagesFor(cap); page += 1) {
        const res = await fetchBuildsPage({ auth, projectId, cursor, signal: controller.signal });
        if (controller.signal.aborted) return;
        all.push(...res.builds);
        pages = page;
        more = res.nextCursor !== null;
        setBuilds(all.slice(0, cap));
        setPagesLoaded(page);
        if (res.nextCursor === null || all.length >= cap) break;
        cursor = res.nextCursor;
      }
      const picked = all.slice(0, cap);
      const cut = more || all.length > cap;
      setBuilds(picked);
      setTruncated(cut);
      writeCache<CachedBuilds>(key, { builds: picked, truncated: cut, pagesLoaded: pages });
      setStatus("ready");
    })().catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading builds."));
      setStatus("error");
    });

    return () => controller.abort();
  }, [credentials, projectId, cap, nonce]);

  return { status, builds, error, truncated, pagesLoaded, reload };
}
