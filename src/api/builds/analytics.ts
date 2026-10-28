import type { Build } from "./types";

/** Pure build-level analytics (B1, B2, B4, B5, B6, B8). Everything here is computed from already-fetched builds. */

const DAY_MS = 86_400_000;

const ts = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

const isApproved = (b: Build) => b.reviewState === "approved";
const hasDiffs = (b: Build) => (b.comparisonsWithDiffs ?? 0) > 0;

const dayKey = (t: number) => {
  const d = new Date(t);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dd}`;
};

/* ------------------------------------------------------------------ B1 */

export interface TrendDay {
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  builds: number;
  withDiffs: number;
  approved: number;
  unreviewed: number;
  changesRequested: number;
  rejected: number;
  failed: number;
  other: number;
}

export interface TrendSummary {
  days: TrendDay[];
  totalBuilds: number;
  /** % of finished builds that had at least one comparison with a diff. */
  diffRatePct: number | null;
}

const emptyDay = (day: string): TrendDay => ({
  day,
  builds: 0,
  withDiffs: 0,
  approved: 0,
  unreviewed: 0,
  changesRequested: 0,
  rejected: 0,
  failed: 0,
  other: 0,
});

/** B1: builds per day with review-state mix and diff rate. Days without builds are included so charts have no gaps. */
export function buildTrend(builds: Build[]): TrendSummary {
  const map = new Map<string, TrendDay>();
  let min = Infinity;
  let max = -Infinity;
  for (const b of builds) {
    const t = ts(b.createdAt);
    if (t === null) continue;
    min = Math.min(min, t);
    max = Math.max(max, t);
    const key = dayKey(t);
    const d = map.get(key) ?? emptyDay(key);
    map.set(key, d);
    d.builds += 1;
    if (hasDiffs(b)) d.withDiffs += 1;
    if (b.state === "failed") d.failed += 1;
    else if (b.reviewState === "approved") d.approved += 1;
    else if (b.reviewState === "unreviewed") d.unreviewed += 1;
    else if (b.reviewState === "changes_requested") d.changesRequested += 1;
    else if (b.reviewState === "rejected") d.rejected += 1;
    else d.other += 1;
  }
  const days: TrendDay[] = [];
  if (Number.isFinite(min)) {
    const end = new Date(dayKey(max) + "T00:00:00").getTime();
    for (let t = new Date(dayKey(min) + "T00:00:00").getTime(); t <= end; t += DAY_MS) {
      const key = dayKey(t);
      days.push(map.get(key) ?? emptyDay(key));
    }
  }
  const finished = builds.filter((b) => b.state === "finished");
  return {
    days,
    totalBuilds: builds.length,
    diffRatePct: finished.length ? (finished.filter(hasDiffs).length / finished.length) * 100 : null,
  };
}

/* ------------------------------------------------------------------ B2 */

export interface ReviewSla {
  reviewedCount: number;
  medianSeconds: number | null;
  p90Seconds: number | null;
  /** Finished builds with diffs that still need a review, longest waiting first. */
  waiting: { build: Build; waitingSeconds: number }[];
}

/** B2: time from finished-at to approved-at, plus the queue of builds still waiting for review. */
export function reviewSla(builds: Build[], now: number = Date.now()): ReviewSla {
  const durations: number[] = [];
  const waiting: ReviewSla["waiting"] = [];
  for (const b of builds) {
    const finished = ts(b.finishedAt);
    if (finished === null) continue;
    const approved = ts(b.approvedAt);
    if (isApproved(b) && approved !== null && approved >= finished) {
      durations.push((approved - finished) / 1000);
    } else if (b.state === "finished" && b.reviewState === "unreviewed" && hasDiffs(b)) {
      waiting.push({ build: b, waitingSeconds: Math.max(0, (now - finished) / 1000) });
    }
  }
  waiting.sort((a, b) => b.waitingSeconds - a.waitingSeconds);
  return { reviewedCount: durations.length, medianSeconds: median(durations), p90Seconds: percentile(durations, 90), waiting };
}

/* ------------------------------------------------------------------ B4 */

export interface FailureSummary {
  failedBuilds: number;
  failureRatePct: number | null;
  buildsWithFailedSnapshots: number;
  totalFailedSnapshots: number;
  /** Builds that never got a finalized-at (CI never completed them). */
  neverFinalized: Build[];
  reasons: { reason: string; count: number }[];
}

/** B4: why builds / snapshots failed. Reasons come from the error buckets, failure-reason or failed-type. */
export function failureAnalysis(builds: Build[]): FailureSummary {
  const reasons = new Map<string, number>();
  let failedBuilds = 0;
  let buildsWithFailedSnapshots = 0;
  let totalFailedSnapshots = 0;
  const neverFinalized: Build[] = [];
  for (const b of builds) {
    if (b.state === "failed") {
      failedBuilds += 1;
      const keys = b.errorBuckets.length ? b.errorBuckets : [b.failureReason ?? b.failedType ?? "unknown"];
      for (const k of keys) reasons.set(k, (reasons.get(k) ?? 0) + 1);
    }
    if ((b.failedSnapshots ?? 0) > 0) {
      buildsWithFailedSnapshots += 1;
      totalFailedSnapshots += b.failedSnapshots ?? 0;
    }
    if (b.finalizedAt === null && b.state !== "processing" && b.state !== "waiting") neverFinalized.push(b);
  }
  return {
    failedBuilds,
    failureRatePct: builds.length ? (failedBuilds / builds.length) * 100 : null,
    buildsWithFailedSnapshots,
    totalFailedSnapshots,
    neverFinalized,
    reasons: [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  };
}

/* ------------------------------------------------------------------ B5 */

export interface PullRequestRow {
  number: number;
  title: string | null;
  url: string | null;
  builds: number;
  buildsWithDiffs: number;
  rejectedOrChanges: number;
  latest: Build;
  /** Review state of the newest build on the PR. */
  finalState: string | null;
}

/** B5: one row per pull request with how many builds it needed and where it ended up. */
export function pullRequestQuality(builds: Build[]): PullRequestRow[] {
  const map = new Map<number, Build[]>();
  for (const b of builds) {
    if (!b.isPullRequest || b.pullRequestNumber === null) continue;
    map.set(b.pullRequestNumber, [...(map.get(b.pullRequestNumber) ?? []), b]);
  }
  const rows: PullRequestRow[] = [];
  for (const [number, list] of map) {
    const sorted = [...list].sort((a, b) => (ts(b.createdAt) ?? 0) - (ts(a.createdAt) ?? 0));
    const latest = sorted[0];
    rows.push({
      number,
      title: latest.pullRequestTitle,
      url: latest.pullRequestUrl,
      builds: list.length,
      buildsWithDiffs: list.filter(hasDiffs).length,
      rejectedOrChanges: list.filter((b) => b.reviewState === "rejected" || b.reviewState === "changes_requested").length,
      latest,
      finalState: latest.reviewState,
    });
  }
  return rows.sort((a, b) => b.builds - a.builds || b.number - a.number);
}

/* ------------------------------------------------------------------ B6 */

export interface ParallelGroup {
  nonce: string;
  builds: Build[];
  expectedShards: number | null;
}

export interface ParallelIntegrity {
  partialBuilds: Build[];
  groups: ParallelGroup[];
  /** Groups that report more shards than builds seen. */
  incompleteGroups: ParallelGroup[];
}

/** B6: partial builds and parallel runs (builds sharing a nonce) that look incomplete. */
export function parallelIntegrity(builds: Build[]): ParallelIntegrity {
  const partialBuilds = builds.filter((b) => b.partial);
  const byNonce = new Map<string, Build[]>();
  for (const b of builds) {
    if (!b.parallelNonce) continue;
    byNonce.set(b.parallelNonce, [...(byNonce.get(b.parallelNonce) ?? []), b]);
  }
  const groups: ParallelGroup[] = [...byNonce.entries()].map(([nonce, list]) => {
    const n = Number(list.find((b) => b.parallelShards !== null)?.parallelShards);
    return { nonce, builds: list, expectedShards: Number.isFinite(n) && n > 0 ? n : null };
  });
  const incompleteGroups = groups.filter((g) => g.expectedShards !== null && g.builds.length < (g.expectedShards ?? 0));
  return { partialBuilds, groups, incompleteGroups };
}

/* ------------------------------------------------------------------ B8 */

export interface ReviewerRow {
  reviewer: string;
  approvals: number;
  lastApprovedAt: string | null;
  medianSeconds: number | null;
}

/** B8: approvals per reviewer. Builds whose approver Percy did not include are grouped under "Unknown". */
export function reviewerWorkload(builds: Build[]): ReviewerRow[] {
  const map = new Map<string, { n: number; last: number; durations: number[] }>();
  for (const b of builds) {
    if (!isApproved(b)) continue;
    const name = b.approvedBy?.trim() || "Unknown";
    const approved = ts(b.approvedAt) ?? 0;
    const finished = ts(b.finishedAt);
    const entry = map.get(name) ?? { n: 0, last: 0, durations: [] };
    entry.n += 1;
    entry.last = Math.max(entry.last, approved);
    if (finished !== null && approved > 0 && approved >= finished) entry.durations.push((approved - finished) / 1000);
    map.set(name, entry);
  }
  return [...map.entries()]
    .map(([reviewer, e]) => ({
      reviewer,
      approvals: e.n,
      lastApprovedAt: e.last ? new Date(e.last).toISOString() : null,
      medianSeconds: median(e.durations),
    }))
    .sort((a, b) => b.approvals - a.approvals);
}