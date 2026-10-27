import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { cacheOwner, clearProjectsCache, readProjectsCache, writeProjectsCache } from "./cache";
import { listProjects } from "./projectsApi";
import { projectsForScope, scopeOfCredentials, type CredentialScope } from "./scope";
import type { Project } from "./types";

export type ProjectsState =
  | { status: "loading"; projects: Project[]; error: null }
  | { status: "ready"; projects: Project[]; error: null }
  | { status: "error"; projects: Project[]; error: ApiError };

export type ProjectsContextValue = ProjectsState & {
  /** Retry after an error. Uses the cache when it has the list. */
  reload: () => void;
  /** Throw the cached list away and ask Percy again ("Hot reload"). */
  hotReload: () => void;
  /** When the projects were last fetched from Percy, or null before the first fetch. */
  fetchedAt: number | null;
  /** True when the list on screen came from the browser cache rather than a fresh request. */
  fromCache: boolean;
  /** Product family the credentials can read; the Projects page hides the type filter for a single-kind token. */
  scope: CredentialScope;
};

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

/**
 * Loads every project the stored credentials can access and shares the result with the whole app
 * (sidebar picker and Projects page). The list is cached in the browser, so reloading the page or
 * coming back later does not call Percy again; "Hot reload" clears the cache and fetches fresh data.
 * Only projects are cached. Builds, snapshots and everything else always hit the API.
 */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { credentials } = useAuth();
  const [state, setState] = useState<ProjectsState>({ status: "loading", projects: [], error: null });
  const [meta, setMeta] = useState<{ fetchedAt: number | null; fromCache: boolean }>({ fetchedAt: null, fromCache: false });
  const [nonce, setNonce] = useState(0);
  /** Set by hotReload so the next load skips the cache even though it is still on disk. */
  const bypassCache = useRef(false);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const hotReload = useCallback(() => {
    clearProjectsCache();
    bypassCache.current = true;
    // Drop the list on screen as well, so the page shows its loading state while Percy is asked again
    // instead of keeping the stale rows until the new ones arrive.
    setState({ status: "loading", projects: [], error: null });
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    const auth = authFromCredentials(credentials);
    if (!auth) {
      setState({
        status: "error",
        projects: [],
        error: new ApiError("not_authenticated", "You are not signed in.", {
          hint: "Sign in with a Percy token or BrowserStack credentials to see your projects.",
        }),
      });
      return;
    }

    const scope = scopeOfCredentials(credentials);
    const owner = cacheOwner(credentials);

    // The cache was cleared by hotReload, so it is empty anyway; the flag only has to survive until a
    // request actually completes, because React may run this effect twice in development.
    if (!bypassCache.current) {
      const cached = readProjectsCache(owner);
      if (cached) {
        setState({ status: "ready", projects: projectsForScope(cached.projects, scope), error: null });
        setMeta({ fetchedAt: cached.savedAt || null, fromCache: true });
        return;
      }
    }

    const controller = new AbortController();
    setState((prev) => ({ status: "loading", projects: prev.projects, error: null }));

    listProjects({ auth, signal: controller.signal })
      .then((projects) => {
        bypassCache.current = false;
        writeProjectsCache(owner, projects);
        setState({ status: "ready", projects: projectsForScope(projects, scope), error: null });
        setMeta({ fetchedAt: Date.now(), fromCache: false });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const error = isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading projects.");
        setState({ status: "error", projects: [], error });
      });

    return () => controller.abort();
  }, [credentials, nonce]);

  const scope = useMemo(() => scopeOfCredentials(credentials), [credentials]);
  const value = useMemo<ProjectsContextValue>(
    () => ({ ...state, reload, hotReload, fetchedAt: meta.fetchedAt, fromCache: meta.fromCache, scope }),
    [state, reload, hotReload, meta, scope],
  );
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used inside <ProjectsProvider>");
  return ctx;
}
