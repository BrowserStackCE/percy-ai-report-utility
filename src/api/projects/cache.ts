import type { Project } from "./types";

/**
 * Browser cache for the projects list only. Projects change rarely and every page needs them, so the
 * list is kept in localStorage and reused until the user presses "Hot reload". Builds, snapshots and
 * every other API are never cached.
 */
const KEY = "percy_report_projects_cache";
/** Bump when the Project shape changes so an old cache is ignored instead of misread. */
const VERSION = 2;

interface CacheEntry {
  v: number;
  /** Identifies whose projects these are, so signing in as someone else never shows the old list. */
  owner: string;
  savedAt: number;
  projects: Project[];
}

/** A stable, non-secret fingerprint of the credentials (never the credentials themselves). */
export function cacheOwner(c: { percyToken?: string; username?: string; accessKey?: string }): string {
  const raw = c.username && c.accessKey ? `bs:${c.username}:${c.accessKey}` : `pt:${c.percyToken ?? ""}`;
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function readProjectsCache(owner: string): { projects: Project[]; savedAt: number } | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    const entry = JSON.parse(text) as Partial<CacheEntry>;
    if (entry.v !== VERSION || entry.owner !== owner || !Array.isArray(entry.projects)) return null;
    return { projects: entry.projects, savedAt: typeof entry.savedAt === "number" ? entry.savedAt : 0 };
  } catch {
    return null;
  }
}

export function writeProjectsCache(owner: string, projects: Project[]): void {
  try {
    const entry: CacheEntry = { v: VERSION, owner, savedAt: Date.now(), projects };
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch {
    /* storage full or unavailable: the app simply fetches every time */
  }
}

export function clearProjectsCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
