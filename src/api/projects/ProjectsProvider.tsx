import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { ApiError, isApiError } from "../errors";
import { authFromCredentials } from "../http";
import { listProjects } from "./projectsApi";
import type { Project } from "./types";

export type ProjectsState =
  | { status: "loading"; projects: Project[]; error: null }
  | { status: "ready"; projects: Project[]; error: null }
  | { status: "error"; projects: Project[]; error: ApiError };

export type ProjectsContextValue = ProjectsState & { reload: () => void };

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

/**
 * Loads every project the stored credentials can access, once, and shares the result with the
 * whole app (sidebar picker and Projects page) so navigating never triggers a second request.
 * Reloads when the credentials change or `reload()` is called.
 */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const { credentials } = useAuth();
  const [state, setState] = useState<ProjectsState>({ status: "loading", projects: [], error: null });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

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

    const controller = new AbortController();
    setState((prev) => ({ status: "loading", projects: prev.projects, error: null }));

    listProjects({ auth, signal: controller.signal })
      .then((projects) => setState({ status: "ready", projects, error: null }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const error = isApiError(err) ? err : new ApiError("unexpected", "Something went wrong while loading projects.");
        setState({ status: "error", projects: [], error });
      });

    return () => controller.abort();
  }, [credentials, nonce]);

  const value = useMemo<ProjectsContextValue>(() => ({ ...state, reload }), [state, reload]);
  return <ProjectsContext.Provider value={value}>{children}</ProjectsContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProjects(): ProjectsContextValue {
  const ctx = useContext(ProjectsContext);
  if (!ctx) throw new Error("useProjects must be used inside <ProjectsProvider>");
  return ctx;
}
