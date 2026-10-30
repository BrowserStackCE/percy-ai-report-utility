/**
 * In-memory cache for fully loaded report data (builds, snapshots, analytics). An entry is saved only
 * once its data has completely loaded, and is reused when the user leaves a page and comes back.
 * It is dropped on a hot reload or when the page is refreshed in the browser.
 */
const store = new Map<string, unknown>();
const listeners = new Set<() => void>();

export function readCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function writeCache<T>(key: string, value: T): void {
  store.set(key, value);
}

/** Forget every cached entry and tell mounted hooks to fetch again. */
export function clearDataCache(): void {
  store.clear();
  listeners.forEach((fn) => fn());
}

/** Subscribe to cache clears (hot reload). Returns the unsubscribe function. */
export function onDataCacheCleared(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** A stable key from a list of parts. */
export const cacheKey = (...parts: Array<string | number | null | undefined>): string => parts.map((p) => String(p ?? "")).join("|");
