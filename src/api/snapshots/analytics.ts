import { comparisonRatio } from "./aggregate";
import type { Snapshot, SnapshotComparison } from "./types";

/**
 * Pure snapshot-level analytics (C1–C8). Every function works on snapshots that were already fetched,
 * each tagged with the build they came from so snapshots can be followed across builds.
 */

export interface BuildSnapshots {
  buildId: string;
  /** Build number for display; null when Percy did not return one. */
  buildNumber: number | null;
  snapshots: Snapshot[];
}

/** Percy's `name` is the unique snapshot name; `display-name` is a build-wide label (identical for every snapshot here). */
const label = (s: Snapshot) => s.name;

/** The comparison with the largest diff, which stands for the snapshot. */
function worstComparison(s: Snapshot): SnapshotComparison | null {
  let worst: SnapshotComparison | null = s.comparisons[0] ?? null;
  let max = -1;
  for (const c of s.comparisons) {
    const r = comparisonRatio(c);
    if (r > max) {
      max = r;
      worst = c;
    }
  }
  return worst;
}

const snapshotRatio = (s: Snapshot) => {
  const c = worstComparison(s);
  return c ? comparisonRatio(c) : 0;
};

const deviceLabel = (c: SnapshotComparison) => {
  const d = c.device;
  if (!d) return "Unknown";
  return d.browserName ? d.browserName.charAt(0).toUpperCase() + d.browserName.slice(1) : (d.name ?? "Unknown");
};

/* ------------------------------------------------------------------ C1 */

export interface NoisySnapshot {
  name: string;
  /** Builds in which this snapshot appeared. */
  appearances: number;
  /** Builds in which it showed a diff. */
  withDiff: number;
  /** withDiff / appearances, 0 to 100. */
  diffRatePct: number;
  averageRatio: number;
  reintroduced: number;
  /** Builds where Percy flagged the diff as recurring. */
  recurring: number;
  /** Build number of the latest build with a diff. */
  lastSeenBuild: number | null;
}

/** C1: snapshots that show a diff in many builds, which usually means flaky content rather than a real change. */
export function noisiestSnapshots(builds: BuildSnapshots[], minAppearances = 2): NoisySnapshot[] {
  const map = new Map<string, NoisySnapshot & { sum: number; lastId: number }>();
  for (const b of builds) {
    for (const s of b.snapshots) {
      const key = s.name;
      const row = map.get(key) ?? {
        name: label(s),
        appearances: 0,
        withDiff: 0,
        diffRatePct: 0,
        averageRatio: 0,
        reintroduced: 0,
        recurring: 0,
        lastSeenBuild: null,
        sum: 0,
        lastId: -1,
      };
      map.set(key, row);
      row.appearances += 1;
      if (s.isReintroduced) row.reintroduced += 1;
      const ratio = snapshotRatio(s);
      if (ratio > 0) {
        row.withDiff += 1;
        row.sum += ratio;
        const id = Number(b.buildId);
        if (Number.isFinite(id) && id > row.lastId) {
          row.lastId = id;
          row.lastSeenBuild = b.buildNumber;
        }
      }
      if (s.comparisons.some((c) => c.recurringDiffStatus && /recurr/i.test(c.recurringDiffStatus))) row.recurring += 1;
    }
  }
  return [...map.values()]
    .filter((r) => r.appearances >= minAppearances && r.withDiff > 0)
    .map(({ sum, lastId: _lastId, ...r }) => ({
      ...r,
      diffRatePct: (r.withDiff / r.appearances) * 100,
      averageRatio: sum / r.withDiff,
    }))
    .sort((a, b) => b.diffRatePct - a.diffRatePct || b.withDiff - a.withDiff || a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ C2 */

export interface DiffDistribution {
  buckets: { key: string; label: string; count: number }[];
  comparisonsWithDiff: number;
  /** Mean raw diff of comparisons that have both raw and AI ratios. */
  averageRawRatio: number | null;
  averageAiRatio: number | null;
  /** 0 to 100: how much of the raw diff the AI filtered out. */
  noiseRemovedPct: number | null;
  top: { name: string; ratio: number; rawRatio: number | null }[];
}

const DIFF_BUCKETS = [
  { key: "lt1", label: "Under 1%", min: 0.0000001, max: 0.01 },
  { key: "1to5", label: "1% to 5%", min: 0.01, max: 0.05 },
  { key: "5to10", label: "5% to 10%", min: 0.05, max: 0.1 },
  { key: "10to25", label: "10% to 25%", min: 0.1, max: 0.25 },
  { key: "gt25", label: "Over 25%", min: 0.25, max: Infinity },
];

/** C2: how big the diffs are, and how much smaller they get once Percy AI filters noise. */
export function diffDistribution(snapshots: Snapshot[], topN = 10): DiffDistribution {
  const counts = DIFF_BUCKETS.map((b) => ({ key: b.key, label: b.label, count: 0 }));
  let withDiff = 0;
  let rawSum = 0;
  let aiSum = 0;
  let paired = 0;
  const top: DiffDistribution["top"] = [];
  for (const s of snapshots) {
    for (const c of s.comparisons) {
      const ratio = comparisonRatio(c);
      if (ratio > 0) {
        withDiff += 1;
        const i = DIFF_BUCKETS.findIndex((b) => ratio >= b.min && ratio < b.max);
        if (i >= 0) counts[i].count += 1;
        top.push({ name: label(s), ratio, rawRatio: c.diffRatio });
      }
      if (c.diffRatio !== null && c.aiDiffRatio !== null) {
        rawSum += c.diffRatio;
        aiSum += c.aiDiffRatio;
        paired += 1;
      }
    }
  }
  top.sort((a, b) => b.ratio - a.ratio || a.name.localeCompare(b.name));
  return {
    buckets: counts,
    comparisonsWithDiff: withDiff,
    averageRawRatio: paired ? rawSum / paired : null,
    averageAiRatio: paired ? aiSum / paired : null,
    noiseRemovedPct: paired && rawSum > 0 ? Math.max(0, ((rawSum - aiSum) / rawSum) * 100) : null,
    top: top.slice(0, topN),
  };
}

/* ------------------------------------------------------------------ C3 */

export interface AiEffectiveness {
  comparisons: number;
  aiEnabled: number;
  aiCompleted: number;
  aiFailed: number;
  /** Comparisons with a raw diff. */
  rawDiffs: number;
  /** Comparisons that still show a diff after AI. */
  aiDiffs: number;
  /** Comparisons where AI removed the diff entirely. */
  cleared: number;
  visualDiffs: number;
  failureReasons: { reason: string; count: number }[];
}

/** C3: how much work Percy AI took off reviewers, and how often it failed. */
export function aiEffectiveness(snapshots: Snapshot[]): AiEffectiveness {
  const reasons = new Map<string, number>();
  const out: AiEffectiveness = {
    comparisons: 0,
    aiEnabled: 0,
    aiCompleted: 0,
    aiFailed: 0,
    rawDiffs: 0,
    aiDiffs: 0,
    cleared: 0,
    visualDiffs: 0,
    failureReasons: [],
  };
  for (const s of snapshots) {
    for (const c of s.comparisons) {
      out.comparisons += 1;
      const enabled = c.ai?.enabled === true;
      if (enabled) out.aiEnabled += 1;
      const status = (c.ai?.processingStatus ?? c.aiProcessingState ?? "").toLowerCase();
      if (c.aiFailureReason || /fail|error/.test(status)) {
        out.aiFailed += 1;
        const reason = c.aiFailureReason ?? status;
        reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
      } else if (enabled && /complete|done|finish|success/.test(status)) {
        out.aiCompleted += 1;
      }
      if ((c.diffRatio ?? 0) > 0) {
        out.rawDiffs += 1;
        if (c.aiDiffRatio !== null) {
          if (c.aiDiffRatio > 0) out.aiDiffs += 1;
          else out.cleared += 1;
        }
      }
      out.visualDiffs += c.ai?.visualDiffs ?? 0;
    }
  }
  out.failureReasons = [...reasons.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  return out;
}

/* ------------------------------------------------------------------ C4 */

export interface ReviewBreakdown {
  states: { state: string; count: number }[];
  reasons: { reason: string; count: number }[];
  autoApproved: number;
  humanApproved: number;
  /** Snapshots that still need a decision. */
  outstanding: number;
}

/** C4: review state and the reason behind it, split into auto-approved and human-approved. */
export function reviewBreakdown(snapshots: Snapshot[]): ReviewBreakdown {
  const states = new Map<string, number>();
  const reasons = new Map<string, number>();
  let autoApproved = 0;
  let humanApproved = 0;
  let outstanding = 0;
  for (const s of snapshots) {
    states.set(s.reviewState, (states.get(s.reviewState) ?? 0) + 1);
    if (s.reviewStateReason) reasons.set(s.reviewStateReason, (reasons.get(s.reviewStateReason) ?? 0) + 1);
    if (s.reviewState === "approved" || s.reviewState === "merged") {
      if (s.reviewStateReason && /auto/i.test(s.reviewStateReason)) autoApproved += 1;
      else if (s.reviewStateReason && /no_diffs|previously/i.test(s.reviewStateReason)) {
        // Approved because nothing changed or already approved earlier: neither a fresh human nor an auto decision.
      } else humanApproved += 1;
    }
    if (s.reviewState === "unreviewed" || s.reviewState === "changes_requested") outstanding += 1;
  }
  const rows = <T extends string>(m: Map<string, number>, key: T) =>
    [...m.entries()].map(([k, count]) => ({ [key]: k, count }) as { [P in T]: string } & { count: number }).sort((a, b) => b.count - a.count);
  return {
    states: rows(states, "state"),
    reasons: rows(reasons, "reason"),
    autoApproved,
    humanApproved,
    outstanding,
  };
}

/* ------------------------------------------------------------------ C5 */

export interface CommentHotspot {
  snapshotId: string;
  buildId: string | null;
  name: string;
  openComments: number;
  reviewState: string;
}

/** C5: snapshots with unresolved comments, most comments first. */
export function commentHotspots(snapshots: Snapshot[], topN = 10): { total: number; snapshotsWithComments: number; top: CommentHotspot[] } {
  const withComments = snapshots.filter((s) => (s.openComments ?? 0) > 0);
  return {
    total: withComments.reduce((n, s) => n + (s.openComments ?? 0), 0),
    snapshotsWithComments: withComments.length,
    top: withComments
      .sort((a, b) => (b.openComments ?? 0) - (a.openComments ?? 0) || label(a).localeCompare(label(b)))
      .slice(0, topN)
      .map((s) => ({ snapshotId: s.id, buildId: s.buildId, name: label(s), openComments: s.openComments ?? 0, reviewState: s.reviewState })),
  };
}

/* ------------------------------------------------------------------ C6 */

export interface RenderingRisk {
  total: number;
  javascriptEnabled: number;
  layoutEnabled: number;
  withScopeSelector: number;
  withLayoutWarning: number;
  warnings: { snapshotId: string; name: string; warning: string }[];
}

/** C6: how snapshots are rendered, and which ones Percy warned about. */
export function renderingRisk(snapshots: Snapshot[], topN = 10): RenderingRisk {
  const warnings: RenderingRisk["warnings"] = [];
  let js = 0;
  let layout = 0;
  let scope = 0;
  for (const s of snapshots) {
    if (s.enableJavascript) js += 1;
    if (s.enableLayout) layout += 1;
    if (s.scopeSelector) scope += 1;
    if (s.layoutWarning) warnings.push({ snapshotId: s.id, name: label(s), warning: s.layoutWarning });
  }
  return {
    total: snapshots.length,
    javascriptEnabled: js,
    layoutEnabled: layout,
    withScopeSelector: scope,
    withLayoutWarning: warnings.length,
    warnings: warnings.slice(0, topN),
  };
}

/* ------------------------------------------------------------------ C7 */

export interface TestCaseRow {
  testCase: string;
  snapshots: number;
  withDiff: number;
  averageRatio: number;
  /** Link to the BrowserStack session for the worst comparison, when Percy gave one. */
  debugUrl: string | null;
}

/** C7: which tests produce the most diffs. Snapshots without a test case are left out. */
export function testCaseTraceability(snapshots: Snapshot[], topN = 10): TestCaseRow[] {
  const map = new Map<string, TestCaseRow & { sum: number; best: number }>();
  for (const s of snapshots) {
    const key = s.testCaseName ?? s.testCaseId;
    if (!key) continue;
    const row = map.get(key) ?? { testCase: key, snapshots: 0, withDiff: 0, averageRatio: 0, debugUrl: null, sum: 0, best: -1 };
    map.set(key, row);
    row.snapshots += 1;
    const ratio = snapshotRatio(s);
    if (ratio > 0) {
      row.withDiff += 1;
      row.sum += ratio;
      const url = worstComparison(s)?.externalDebugUrl ?? null;
      if (url && ratio > row.best) {
        row.best = ratio;
        row.debugUrl = url;
      }
    }
  }
  return [...map.values()]
    .map(({ sum, best: _best, ...r }) => ({ ...r, averageRatio: r.withDiff ? sum / r.withDiff : 0 }))
    .sort((a, b) => b.withDiff - a.withDiff || b.snapshots - a.snapshots || a.testCase.localeCompare(b.testCase))
    .slice(0, topN);
}

/* ------------------------------------------------------------------ C8 */

export interface DiffRateRow {
  key: string;
  label: string;
  comparisons: number;
  withDiff: number;
  diffRatePct: number;
}

export interface ResponsiveAnalysis {
  byWidth: DiffRateRow[];
  byBrowser: DiffRateRow[];
}

function rate(map: Map<string, { label: string; comparisons: number; withDiff: number }>): DiffRateRow[] {
  return [...map.entries()]
    .map(([key, v]) => ({ key, ...v, diffRatePct: v.comparisons ? (v.withDiff / v.comparisons) * 100 : 0 }))
    .sort((a, b) => b.diffRatePct - a.diffRatePct || b.comparisons - a.comparisons);
}

/** C8: diff rate per viewport width and per browser, to find the breakpoint or browser that regresses most. */
export function responsiveAnalysis(snapshots: Snapshot[]): ResponsiveAnalysis {
  const widths = new Map<string, { label: string; comparisons: number; withDiff: number }>();
  const browsers = new Map<string, { label: string; comparisons: number; withDiff: number }>();
  const bump = (m: typeof widths, key: string, text: string, diff: boolean) => {
    const row = m.get(key) ?? { label: text, comparisons: 0, withDiff: 0 };
    row.comparisons += 1;
    if (diff) row.withDiff += 1;
    m.set(key, row);
  };
  for (const s of snapshots) {
    for (const c of s.comparisons) {
      const diff = comparisonRatio(c) > 0;
      if (c.width) bump(widths, String(c.width), `${c.width}px`, diff);
      bump(browsers, deviceLabel(c).toLowerCase(), deviceLabel(c), diff);
    }
  }
  return { byWidth: rate(widths), byBrowser: rate(browsers) };
}