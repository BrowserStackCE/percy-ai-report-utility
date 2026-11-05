import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { cacheKey, onDataCacheCleared, readCache, writeCache } from "../dataCache";
import { fetchBuild } from "./buildsApi";
import type { Build } from "./types";

export interface BuildState {
  status: "loading" | "ready" | "error";
  build: Build | null;
  error: ApiError | null;
  reload: () => void;
}

/** One build with all of its details (GET /builds/:id). */
export function useBuild(buildId: string): BuildState {
  const { credentials } = useAuth();
  const [build, setBuild] = useState<Build | null>(null);
  const [status, setStatus] = useState<BuildState["status"]>("loading");
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => onDataCacheCleared(() => setNonce((n) => n + 1)), []);

  useEffect(() => {
    // No build in the URL (for example the breadcrumb on other pages): nothing to load.
    if (!buildId) {
      setBuild(null);
      setError(null);
      setStatus("loading");
      return;
    }
    const auth = authFromCredentials(credentials);
    if (!auth) {
      setBuild(null);
      setStatus("error");
      setError(new ApiError("not_authenticated", "You are not signed in.", { hint: "Sign in to see this build." }));
      return;
    }
    const key = cacheKey("build", buildId);
    const cached = readCache<Build>(key);
    if (cached) {
      setBuild(cached);
      setError(null);
      setStatus("ready");
      return;
    }

    const controller = new AbortController();
    setStatus("loading");
    setError(null);
    fetchBuild(buildId, { auth, signal: controller.signal })
      .then((b) => {
        writeCache(key, b);
        setBuild(b);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setBuild(null);
        setError(isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading the build."));
        setStatus("error");
      });
    return () => controller.abort();
  }, [credentials, buildId, nonce]);

  return { status, build, error, reload };
}
