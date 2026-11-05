import type { Snapshot, SnapshotReviewState } from "./types";

/** Labels for the diff-size buckets, from untouched to heavily changed. */
export type DiffBucketKey = "none" | "minor" | "moderate" | "major";

export interface DiffBucket {
  key: DiffBucketKey;
  label: string;
  /** Inclusive lower bound, as a fraction (0.05 = 5%). */
  min: number;
  count: number;
}

export interface CountRow {
  key: string;
  label: string;
  count: number;
}

export interface TopDiff {
  snapshotId: string;
  name: string;
  /** Fraction of the page that changed (AI-filtered when Percy AI ran). */
  ratio: number;
  reviewState: SnapshotReviewState;
  imageUrl: string | null;
  device: string | null;
}

/** The roll-up shown at the top of a build report. Every figure is derived from the snapshots passed in. */
export interface SnapshotAggregate {
  snapshots: number;
  comparisons: number;
  /** Snapshots with at least one comparison that shows a diff. */
  snapshotsWithDiffs: number;
  snapshotsWithoutDiffs: number;
  /** Mean diff of the snapshots that changed, as a fraction. Null when nothing changed. */
  averageDiffRatio: number | null;
  maxDiffRatio: number | null;
  openComments: number;
  reintroduced: number;
  withTestCase: number;
  review: CountRow[];
  reviewReasons: CountRow[];
  diffBuckets: DiffBucket[];
  browsers: CountRow[];
  operatingSystems: CountRow[];
  widths: CountRow[];
  ai: {
    /** Comparisons Percy AI analysed. */
    analysed: number;
    /** Visual diffs the AI kept. */
    visualDiffs: number;
    /** Raw diff share minus AI-filtered diff share, averaged: how much noise AI removed. */
    averageNoiseRemoved: number | null;
    snapshotsWithAi: number;
  };
  topDiffs: TopDiff[];
}

const BUCKETS: Array<Omit<DiffBucket, "count">> = [
  { key: "none", label: "No change", min: 0 },
  { key: "minor", label: "Under 1%", min: 0.0000001 },
  { key: "moderate", label: "1% to 10%", min: 0.01 },
  { key: "major", label: "Over 10%", min: 0.1 },
];

/** The diff share that represents a comparison: AI-filtered when available, otherwise the raw ratio. */
export function comparisonRatio(c: { aiDiffRatio: number | null; diffRatio: number | null }): number {
  return c.aiDiffRatio ?? c.diffRatio ?? 0;
}

function bump(map: Map<string, CountRow>, key: string | null, label?: string) {
  if (!key) return;
  const row = map.get(key);
  if (row) row.count += 1;
  else map.set(key, { key, label: label ?? key, count: 1 });
}

const byCountDesc = (a: CountRow, b: CountRow) => b.count - a.count || a.label.localeCompare(b.label);

function titleCase(v: string): string {
  const t = v.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export const REVIEW_LABELS: Record<SnapshotReviewState, string> = {
  approved: "Approved",
  merged: "Merged",
  unreviewed: "Unreviewed",
  changes_requested: "Changes requested",
  rejected: "Rejected",
  unknown: "Unknown",
};

/** Roll a list of snapshots up into the figures a report needs. Pure: same input, same output. */
export function aggregateSnapshots(snapshots: Snapshot[], topN = 5): SnapshotAggregate {
  const review = new Map<string, CountRow>();
  const reasons = new Map<string, CountRow>();
  const browsers = new Map<string, CountRow>();
  const systems = new Map<string, CountRow>();
  const widths = new Map<string, CountRow>();
  const buckets = BUCKETS.map((b) => ({ ...b, count: 0 }));

  let comparisons = 0;
  let withDiffs = 0;
  let diffSum = 0;
  let maxRatio = 0;
  let openComments = 0;
  let reintroduced = 0;
  let withTestCase = 0;
  let aiAnalysed = 0;
  let aiVisualDiffs = 0;
  let snapshotsWithAi = 0;
  let noiseSum = 0;
  let noiseN = 0;
  const top: TopDiff[] = [];

  for (const s of snapshots) {
    bump(review, s.reviewState, REVIEW_LABELS[s.reviewState]);
    bump(reasons, s.reviewStateReason, s.reviewStateReason ? titleCase(s.reviewStateReason) : undefined);
    openComments += s.openComments ?? 0;
    if (s.isReintroduced) reintroduced += 1;
    if (s.testCaseId) withTestCase += 1;

    let worst = 0;
    let worstCmp = s.comparisons[0] ?? null;
    let aiHere = false;
    for (const c of s.comparisons) {
      comparisons += 1;
      const ratio = comparisonRatio(c);
      if (ratio > worst) {
        worst = ratio;
        worstCmp = c;
      }
      if (c.width) bump(widths, String(c.width), `${c.width}px`);
      const d = c.device;
      if (d?.browserName) bump(browsers, d.browserName.toLowerCase(), titleCase(d.browserName));
      if (d?.osName) bump(systems, d.osName.toLowerCase(), d.osName);
      if (c.ai?.enabled) {
        aiAnalysed += 1;
        aiVisualDiffs += c.ai.visualDiffs ?? 0;
        aiHere = true;
      }
      if (c.aiDiffRatio !== null && c.diffRatio !== null) {
        noiseSum += Math.max(0, c.diffRatio - c.aiDiffRatio);
        noiseN += 1;
      }
    }
    if (aiHere) snapshotsWithAi += 1;

    const bucket = [...buckets].reverse().find((b) => (b.key === "none" ? worst === 0 : worst >= b.min));
    if (bucket) bucket.count += 1;

    if (worst > 0) {
      withDiffs += 1;
      diffSum += worst;
      maxRatio = Math.max(maxRatio, worst);
      const d = worstCmp?.device;
      top.push({
        snapshotId: s.id,
        name: s.name,
        ratio: worst,
        reviewState: s.reviewState,
        imageUrl: worstCmp?.imageUrl ?? null,
        device: d ? [d.name ?? (d.browserName ? titleCase(d.browserName) : null), d.osName].filter(Boolean).join(" · ") || null : null,
      });
    }
  }

  top.sort((a, b) => b.ratio - a.ratio || a.name.localeCompare(b.name));

  return {
    snapshots: snapshots.length,
    comparisons,
    snapshotsWithDiffs: withDiffs,
    snapshotsWithoutDiffs: snapshots.length - withDiffs,
    averageDiffRatio: withDiffs > 0 ? diffSum / withDiffs : null,
    maxDiffRatio: withDiffs > 0 ? maxRatio : null,
    openComments,
    reintroduced,
    withTestCase,
    review: [...review.values()].sort(byCountDesc),
    reviewReasons: [...reasons.values()].sort(byCountDesc),
    diffBuckets: buckets,
    browsers: [...browsers.values()].sort(byCountDesc),
    operatingSystems: [...systems.values()].sort(byCountDesc),
    widths: [...widths.values()].sort((a, b) => Number(a.key) - Number(b.key)),
    ai: {
      analysed: aiAnalysed,
      visualDiffs: aiVisualDiffs,
      averageNoiseRemoved: noiseN > 0 ? noiseSum / noiseN : null,
      snapshotsWithAi,
    },
    topDiffs: top.slice(0, topN),
  };
}
