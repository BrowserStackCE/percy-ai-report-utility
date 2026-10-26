import { comparisonRatio } from "./aggregate";
import type { Snapshot, SnapshotComparison } from "./types";

/** Diff share at or above which a comparison is flagged as a big change (10%). */
export const MAJOR_DIFF = 0.1;

export type ComparisonSeverity = "none" | "minor" | "moderate" | "major";

export function severityOf(ratio: number): ComparisonSeverity {
  if (ratio <= 0) return "none";
  if (ratio < 0.01) return "minor";
  if (ratio < MAJOR_DIFF) return "moderate";
  return "major";
}

/** One comparison with the figures the snapshot report ranks and flags it by. */
export interface RankedComparison {
  comparison: SnapshotComparison;
  /** AI-filtered share when Percy AI ran, otherwise the raw share. */
  ratio: number;
  severity: ComparisonSeverity;
  /** Raw minus AI-filtered share; null unless both were reported. */
  noiseRemoved: number | null;
  /** True when AI failed or did not finish, so the figure may be unfiltered. */
  aiProblem: string | null;
}

/** Why the AI result for a comparison cannot be fully trusted, or null when it is fine or not in use. */
export function aiProblemOf(c: SnapshotComparison): string | null {
  if (c.aiFailureReason) return c.aiFailureReason;
  const state = c.aiProcessingState;
  if (c.ai?.enabled && state && state !== "completed") return `AI is ${state.replace(/[_-]+/g, " ")}`;
  return null;
}

export function rankComparisons(snapshot: Snapshot): RankedComparison[] {
  return snapshot.comparisons
    .map((comparison) => {
      const ratio = comparisonRatio(comparison);
      return {
        comparison,
        ratio,
        severity: severityOf(ratio),
        noiseRemoved:
          comparison.diffRatio !== null && comparison.aiDiffRatio !== null
            ? Math.max(0, comparison.diffRatio - comparison.aiDiffRatio)
            : null,
        aiProblem: aiProblemOf(comparison),
      };
    })
    .sort((a, b) => b.ratio - a.ratio);
}

export interface SnapshotMetrics {
  comparisons: number;
  changed: number;
  unchanged: number;
  maxRatio: number | null;
  averageRatio: number | null;
  /** Mean raw-minus-AI share across comparisons that report both; null when none do. */
  averageNoiseRemoved: number | null;
  aiVisualDiffs: number;
  aiAnalysed: number;
  aiProblems: number;
  /** Comparison counts keyed by severity. */
  bySeverity: Record<ComparisonSeverity, number>;
}

export function snapshotMetrics(snapshot: Snapshot): SnapshotMetrics {
  const ranked = rankComparisons(snapshot);
  const changed = ranked.filter((r) => r.ratio > 0);
  const noise = ranked.map((r) => r.noiseRemoved).filter((n): n is number => n !== null);
  const bySeverity: Record<ComparisonSeverity, number> = { none: 0, minor: 0, moderate: 0, major: 0 };
  for (const r of ranked) bySeverity[r.severity] += 1;
  const aiRuns = snapshot.comparisons.filter((c) => c.ai?.enabled);
  return {
    comparisons: ranked.length,
    changed: changed.length,
    unchanged: ranked.length - changed.length,
    maxRatio: changed.length > 0 ? changed[0].ratio : null,
    averageRatio: changed.length > 0 ? changed.reduce((s, r) => s + r.ratio, 0) / changed.length : null,
    averageNoiseRemoved: noise.length > 0 ? noise.reduce((s, n) => s + n, 0) / noise.length : null,
    aiVisualDiffs: aiRuns.reduce((s, c) => s + (c.ai?.visualDiffs ?? 0), 0),
    aiAnalysed: aiRuns.length,
    aiProblems: ranked.filter((r) => r.aiProblem).length,
    bySeverity,
  };
}

/**
 * Link to review this snapshot in Percy. Percy's build URL is https://percy.io/<org>/<project>/builds/<id>,
 * and its snapshot page is that URL plus /<snapshot id>. Falls back to the build page, or null with no URL.
 */
export function percySnapshotUrl(buildUrl: string | null, snapshotId: string): string | null {
  if (!buildUrl) return null;
  try {
    const url = new URL(buildUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.search = "";
    url.hash = "";
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/${encodeURIComponent(snapshotId)}`;
    return url.toString();
  } catch {
    return null;
  }
}
