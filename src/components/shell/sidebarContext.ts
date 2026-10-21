import { createContext, useContext } from "react";

export interface SidebarState {
  collapsed: boolean;
  toggle: () => void;
}

export const SidebarContext = createContext<SidebarState | null>(null);

/** Read and control the sidebar from any component under SidebarProvider. */
export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside <SidebarProvider>");
  return ctx;
}
