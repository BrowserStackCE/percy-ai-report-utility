import { useCallback, useMemo, useState, type ReactNode } from "react";
import { SidebarContext } from "./sidebarContext";

const STORAGE_KEY = "sidebar-collapsed";

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

/** Owns the sidebar's open/closed state and persists it across reloads. */
export default function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readStored);

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable; state still works for this session */
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
