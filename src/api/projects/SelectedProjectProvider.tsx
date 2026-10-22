import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "percy_report_selected_project";

interface SelectedProjectValue {
  /** Id of the project chosen in the sidebar, or "" when none is chosen. */
  projectId: string;
  setProjectId: (id: string) => void;
}

const SelectedProjectContext = createContext<SelectedProjectValue | null>(null);

function read(): string {
  try {
    return sessionStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Shares the sidebar's project choice with pages (for example Reports). Kept for the browser session. */
export function SelectedProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setState] = useState<string>(() => read());

  const setProjectId = useCallback((id: string) => {
    setState(id);
    try {
      sessionStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* storage unavailable: the choice just won't persist across reloads */
    }
  }, []);

  const value = useMemo(() => ({ projectId, setProjectId }), [projectId, setProjectId]);
  return <SelectedProjectContext.Provider value={value}>{children}</SelectedProjectContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSelectedProject(): SelectedProjectValue {
  const ctx = useContext(SelectedProjectContext);
  if (!ctx) throw new Error("useSelectedProject must be used inside <SelectedProjectProvider>");
  return ctx;
}
