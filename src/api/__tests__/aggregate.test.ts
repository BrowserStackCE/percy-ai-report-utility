import { describe, expect, it } from "vitest";
import { aggregateSnapshots, comparisonRatio } from "../snapshots/aggregate";
import type { Snapshot, SnapshotComparison } from "../snapshots/types";

const cmp = (over: Partial<SnapshotComparison> = {}): SnapshotComparison => ({
  id: "c",
  state: "finished",
  width: 1280,
  diffRatio: null,
  aiDiffRatio: null,
  aiProcessingState: null,
  aiFailureReason: null,
  recurringDiffStatus: null,
  ai: null,
  externalDebugUrl: null,
  imageUrl: null,
  imageWidth: null,
  imageHeight: null,
  device: { name: null, osName: "Linux", osVersion: null, browserName: "chrome", browserVersion: null, orientation: null, resolution: null },
  ...over,
});

const snap = (id: string, comparisons: SnapshotComparison[], over: Partial<Snapshot> = {}): Snapshot => ({
  id,
  buildId: "1",
  name: `snap-${id}`,
  displayName: null,
  reviewState: "unreviewed",
  reviewStateReason: "unreviewed_comparisons",
  fingerprint: null,
  openComments: 0,
  isReintroduced: false,
  enableJavascript: false,
  enableLayout: false,
  layoutWarning: null,
  scopeSelector: null,
  testCaseId: null,
  testCaseName: null,
  comparisons,
  ...over,
});

describe("comparisonRatio", () => {
  it("prefers the AI-filtered ratio, then the raw ratio, then zero", () => {
    expect(comparisonRatio({ aiDiffRatio: 0.02, diffRatio: 0.1 })).toBe(0.02);
    expect(comparisonRatio({ aiDiffRatio: null, diffRatio: 0.1 })).toBe(0.1);
    expect(comparisonRatio({ aiDiffRatio: null, diffRatio: null })).toBe(0);
    expect(comparisonRatio({ aiDiffRatio: 0, diffRatio: 0.5 })).toBe(0);
  });
});

describe("aggregateSnapshots", () => {
  it("returns zeroed totals and nulls for an empty build", () => {
    const a = aggregateSnapshots([]);
    expect(a).toMatchObject({ snapshots: 0, comparisons: 0, snapshotsWithDiffs: 0, averageDiffRatio: null, maxDiffRatio: null });
    expect(a.topDiffs).toEqual([]);
    expect(a.diffBuckets.every((b) => b.count === 0)).toBe(true);
  });

  it("counts snapshots, comparisons and snapshots with changes", () => {
    const a = aggregateSnapshots([
      snap("1", [cmp({ diffRatio: 0.2 }), cmp({ diffRatio: 0 })]),
      snap("2", [cmp()]),
      snap("3", []),
    ]);
    expect(a.snapshots).toBe(3);
    expect(a.comparisons).toBe(3);
    expect(a.snapshotsWithDiffs).toBe(1);
    expect(a.snapshotsWithoutDiffs).toBe(2);
  });

  it("represents a snapshot by its largest comparison for averages and the maximum", () => {
    const a = aggregateSnapshots([
      snap("1", [cmp({ diffRatio: 0.1 }), cmp({ diffRatio: 0.3 })]),
      snap("2", [cmp({ diffRatio: 0.1 })]),
    ]);
    expect(a.maxDiffRatio).toBeCloseTo(0.3);
    expect(a.averageDiffRatio).toBeCloseTo(0.2);
  });

  it("puts each snapshot in exactly one diff bucket", () => {
    const a = aggregateSnapshots([
      snap("1", [cmp()]),
      snap("2", [cmp({ diffRatio: 0.004 })]),
      snap("3", [cmp({ diffRatio: 0.05 })]),
      snap("4", [cmp({ diffRatio: 0.5 })]),
      snap("5", [cmp({ diffRatio: 0.01 })]),
    ]);
    const by = Object.fromEntries(a.diffBuckets.map((b) => [b.key, b.count]));
    expect(by).toEqual({ none: 1, minor: 1, moderate: 2, major: 1 });
    expect(a.diffBuckets.reduce((s, b) => s + b.count, 0)).toBe(5);
  });

  it("groups review states and reasons, most common first", () => {
    const a = aggregateSnapshots([
      snap("1", [], { reviewState: "approved", reviewStateReason: "no_diffs" }),
      snap("2", [], { reviewState: "approved", reviewStateReason: "no_diffs" }),
      snap("3", [], { reviewState: "unreviewed", reviewStateReason: "unreviewed_comparisons" }),
    ]);
    expect(a.review.map((r) => [r.key, r.count])).toEqual([
      ["approved", 2],
      ["unreviewed", 1],
    ]);
    expect(a.reviewReasons[0]).toMatchObject({ key: "no_diffs", label: "No diffs", count: 2 });
  });

  it("totals comments, reintroduced snapshots and linked test cases", () => {
    const a = aggregateSnapshots([
      snap("1", [], { openComments: 2, isReintroduced: true, testCaseId: "9" }),
      snap("2", [], { openComments: 3 }),
      snap("3", [], { openComments: null }),
    ]);
    expect(a).toMatchObject({ openComments: 5, reintroduced: 1, withTestCase: 1 });
  });

  it("counts coverage by browser, operating system and width", () => {
    const firefox = { name: null, osName: "macOS", osVersion: null, browserName: "Firefox", browserVersion: null, orientation: null, resolution: null };
    const a = aggregateSnapshots([
      snap("1", [cmp({ width: 375 }), cmp({ width: 1280 }), cmp({ width: 1280, device: firefox })]),
    ]);
    expect(a.browsers.map((r) => [r.label, r.count])).toEqual([
      ["Chrome", 2],
      ["Firefox", 1],
    ]);
    expect(a.operatingSystems.map((r) => [r.label, r.count])).toEqual([
      ["Linux", 2],
      ["macOS", 1],
    ]);
    expect(a.widths.map((r) => [r.key, r.count])).toEqual([
      ["375", 1],
      ["1280", 2],
    ]);
  });

  it("summarises Percy AI and the average noise it removed", () => {
    const ai = { enabled: true, visualDiffs: 2, processingStatus: "completed", summary: "x", findings: [] };
    const a = aggregateSnapshots([
      snap("1", [cmp({ ai, diffRatio: 0.1, aiDiffRatio: 0.04 })]),
      snap("2", [cmp({ ai: { ...ai, visualDiffs: 1 }, diffRatio: 0.06, aiDiffRatio: 0.06 })]),
      snap("3", [cmp()]),
    ]);
    expect(a.ai).toMatchObject({ analysed: 2, visualDiffs: 3, snapshotsWithAi: 2 });
    expect(a.ai.averageNoiseRemoved).toBeCloseTo(0.03);
  });

  it("ranks the biggest changes and caps the list", () => {
    const list = Array.from({ length: 8 }, (_, i) => snap(String(i + 1), [cmp({ diffRatio: (i + 1) / 100 })]));
    const a = aggregateSnapshots(list, 3);
    expect(a.topDiffs.map((t) => t.snapshotId)).toEqual(["8", "7", "6"]);
    expect(a.topDiffs[0].ratio).toBeCloseTo(0.08);
  });

  it("is deterministic for the same input", () => {
    const input = [snap("1", [cmp({ diffRatio: 0.2 })]), snap("2", [cmp({ diffRatio: 0.2 })])];
    expect(aggregateSnapshots(input)).toEqual(aggregateSnapshots(input));
  });
});
