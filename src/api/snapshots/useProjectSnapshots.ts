import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { fetchBuildsPage } from "../builds/buildsApi";
import { fetchSnapshotsPage } from "./snapshotsApi";
import type { BuildSnapshots } from "./analytics";

/** How many of the newest finished builds feed the snapshot reports. */
export const SNAPSHOT_REPORT_BUILDS = 5;
/** Snapshot pages (30 each) read per build. Keeps the whole report well under Percy's read rate limit. */
export const SNAPSHOT_PAGES_PER_BUILD = 4;

export interface ProjectSnapshotsState {
  status: "idle" | "loading" | "ready" | "error";
  /** One entry per build, newest first. */
  builds: BuildSnapshots[];
  error: ApiError | null;
  /** Builds fully loaded so far, for a progress caption. */
  buildsLoaded: number;
  buildsTotal: number;
  /** True when some build had more snapshots than the per-build page cap. */
  truncated: boolean;
  reload: () => void;
}

/**
 * Snapshots (with comparisons) of the newest finished builds of a project. Used by the snapshot reports,
 * which follow the same snapshot across builds. Results appear build by build as they arrive.
 */
export function useProjectSnapshots(projectId: string): ProjectSnapshotsState {
  const { credentials } = useAuth();
  const [builds, setBuilds] = useState<BuildSnapshots[]>([]);
  const [status, setStatus] = useState<ProjectSnapshotsState["status"]>("idle");
  const [error, setError] = useState<ApiError | null>(null);
  const [buildsLoaded, setBuildsLoaded] = useState(0);
  const [buildsTotal, setBuildsTotal] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    setBuilds([]);
    setBuildsLoaded(0);
    setBuildsTotal(0);
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

    const controller = new AbortController();
    setStatus("loading");
    setError(null);

    (async () => {
      const page = await fetchBuildsPage({ auth, projectId, filters: { state: "finished" }, signal: controller.signal });
      const picked = page.builds.slice(0, SNAPSHOT_REPORT_BUILDS);
      setBuildsTotal(picked.length);
      const loaded: BuildSnapshots[] = [];
      let cut = false;
      for (const b of picked) {
        let cursor: number | null = null;
        let snapshots: BuildSnapshots["snapshots"] = [];
        for (let p = 1; p <= SNAPSHOT_PAGES_PER_BUILD; p += 1) {
          const res = await fetchSnapshotsPage({ auth, buildId: b.id, cursor, signal: controller.signal });
          snapshots = snapshots.concat(res.snapshots);
          if (res.nextCursor === null) break;
          if (p === SNAPSHOT_PAGES_PER_BUILD) cut = true;
          cursor = res.nextCursor;
        }
        if (controller.signal.aborted) return;
        loaded.push({ buildId: b.id, buildNumber: b.buildNumber, snapshots });
        setBuilds([...loaded]);
        setBuildsLoaded(loaded.length);
      }
      setTruncated(cut);
      setStatus("ready");
    })().catch((err: unknown) => {
      if (controller.signal.aborted) return;
      setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading snapshots."));
      setStatus("error");
    });

    return () => controller.abort();
  }, [credentials, projectId, nonce]);

  return { status, builds, error, buildsLoaded, buildsTotal, truncated, reload };
}
