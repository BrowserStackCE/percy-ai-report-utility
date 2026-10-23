/** Small display helpers shared by the build pages. */

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

/** 95 -> "1m 35s", 3700 -> "1h 1m", 0 -> "0s". */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** "unreviewed_snapshots" -> "Unreviewed snapshots". */
export function humanize(value: string | null): string {
  if (!value) return "—";
  const t = value.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function count(n: number | null): string {
  return n === null ? "—" : n.toLocaleString();
}

export function shortSha(sha: string | null): string | null {
  return sha ? sha.slice(0, 7) : null;
}
