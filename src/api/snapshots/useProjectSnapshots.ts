import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { cacheKey, onDataCacheCleared, readCache, writeCache } from "../dataCache";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { fetchBuildsPage } from "../builds/buildsApi";
import { fetchSnapshotsPage } from "./snapshotsApi";
import { SNAPSHOTS_PAGE_SIZE } from "./mapper";
import type { BuildSnapshots } from "./analytics";

/** Most finished builds the snapshot reports may include. */
export const MAX_SNAPSHOT_REPORT_BUILDS = 10;
export const DEFAULT_SNAPSHOT_REPORT_BUILDS = 5;
/** Most snapshots read per build. Percy pages 30 at a time, so the build is walked page by page up to this cap. */
export const MAX_SNAPSHOTS_PER_BUILD = 2000;
const MAX_PAGES_PER_BUILD = Math.ceil(MAX_SNAPSHOTS_PER_BUILD / SNAPSHOTS_PAGE_SIZE);

export interface ProjectSnapshotsState {
  status: "idle" | "loading" | "ready" | "error";
  /** One entry per build, newest first. */
  builds: BuildSnapshots[];
  error: ApiError | null;
  /** Builds fully loaded so far, for a progress caption. */
  buildsLoaded: number;
  buildsTotal: number;
  /** Snapshots loaded so far across all builds, and the number expected, for a progress bar. */
  snapshotsLoaded: number;
  snapshotsExpected: number;
  /** True when some build had more snapshots than MAX_SNAPSHOTS_PER_BUILD. */
  truncated: boolean;
  reload: () => void;
}

interface CachedReport {
  builds: BuildSnapshots[];
  truncated: boolean;
}

/**
 * Snapshots (with comparisons) of the newest `buildLimit` finished builds of a project (max 10). Used by
 * the snapshot reports, which follow the same snapshot across builds. Each build is walked page by page,
 * so builds with more than 120 snapshots are covered up to MAX_SNAPSHOTS_PER_BUILD. Results appear as they
 * arrive; a completed load is cached per project and build count, and a hot reload clears it.
 */
export function useProjectSnapshots(projectId: string, buildLimit: number = DEFAULT_SNAPSHOT_REPORT_BUILDS): ProjectSnapshotsState {
  const limit = Math.min(Math.max(1, buildLimit), MAX_SNAPSHOT_REPORT_BUILDS);
  const { credentials } = useAuth();
  const [builds, setBuilds] = useState<BuildSnapshots[]>([]);
  const [status, setStatus] = useState<ProjectSnapshotsState["status"]>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [buildsLoaded, setBuildsLoaded] = useState(0);
  const [buildsTotal, setBuildsTotal] = useState(0);
  const [snapshotsLoaded, setSnapshotsLoaded] = useState(0);
  const [snapshotsExpected, setSnapshotsExpected] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => onDataCacheCleared(() => setNonce((n) => n + 1)), []);

  useEffect(() => {
    setBuilds([]);
    setBuildsLoaded(0);
    setBuildsTotal(0);
    setSnapshotsLoaded(0);
    setSnapshotsExpected(0);
    setTruncated(false);
    if (!projectId) {
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

    const key = cacheKey("project-snapshots", projectId, limit);
    const cached = readCache<CachedReport>(key);
    if (cached) {
      const total = cached.builds.reduce((n, b) => n + b.snapshots.length, 0);
      setBuilds(cached.builds);
      setBuildsLoaded(cached.builds.length);
      setBuildsTotal(cached.builds.length);
      setSnapshotsLoaded(total);
      setSnapshotsExpected(total);
      setTruncated(cached.truncated);
      setError(null);
      setStatus("ready");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    (async () => {
      // Builds come 30 per page, so keep walking until enough finished builds are collected.
      const picked: Awaited<ReturnType<typeof fetchBuildsPage>>["builds"] = [];
      let buildCursor: number | null = null;
      while (picked.length < limit) {
        const page = await fetchBuildsPage({ auth, projectId, cursor: buildCursor, filters: { state: "finished" }, signal: controller.signal });
        if (controller.signal.aborted) return;
        picked.push(...page.builds);
        if (page.nextCursor === null) break;
        buildCursor = page.nextCursor;
      }
      const chosen = picked.slice(0, limit);
      setBuildsTotal(chosen.length);
      setSnapshotsExpected(chosen.reduce((n, b) => n + Math.min(b.totalSnapshots ?? 0, MAX_SNAPSHOTS_PER_BUILD), 0));

      const loaded: BuildSnapshots[] = [];
      let cut = false;
      let count = 0;
      for (const b of chosen) {
        let cursor: number | null = null;
        let snapshots: BuildSnapshots["snapshots"] = [];
        for (let p = 1; p <= MAX_PAGES_PER_BUILD; p += 1) {
          const res = await fetchSnapshotsPage({ auth, buildId: b.id, cursor, signal: controller.signal });
          if (controller.signal.aborted) return;
          snapshots = snapshots.concat(res.snapshots);
          setSnapshotsLoaded(count + snapshots.length);
          if (res.nextCursor === null) break;
          if (p === MAX_PAGES_PER_BUILD) cut = true;
          cursor = res.nextCursor;
        }
        count += snapshots.length;
        loaded.push({ buildId: b.id, buildNumber: b.buildNumber, snapshots });
        setBuilds([...loaded]);
        setBuildsLoaded(loaded.length);
      }
      setTruncated(cut);
      writeCache<CachedReport>(key, { builds: loaded, truncated: cut });
      setStatus("ready");
    })().catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading snapshots."));
      setStatus("error");
    });

    return () => controller.abort();
  }, [credentials, projectId, limit, nonce]);

  return { status, builds, error, buildsLoaded, buildsTotal, snapshotsLoaded, snapshotsExpected, truncated, reload };
}
