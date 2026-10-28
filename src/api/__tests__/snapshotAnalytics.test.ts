import { describe, expect, it } from "vitest";
import type { Snapshot, SnapshotComparison } from "../snapshots/types";
import {
  aiEffectiveness,
  commentHotspots,
  diffDistribution,
  noisiestSnapshots,
  renderingRisk,
  responsiveAnalysis,
  reviewBreakdown,
  testCaseTraceability,
} from "../snapshots/analytics";

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
  openComments: null,
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

describe("C1 noisiestSnapshots", () => {
  it("ranks snapshots by how often they show a diff across builds", () => {
    const builds = [
      { buildId: "30", buildNumber: 3, snapshots: [snap("a", [cmp({ diffRatio: 0.2 })], { name: "home" }), snap("b", [cmp()], { name: "about" })] },
      { buildId: "20", buildNumber: 2, snapshots: [snap("a", [cmp({ diffRatio: 0.1 })], { name: "home" }), snap("b", [cmp({ diffRatio: 0.05 })], { name: "about" })] },
      { buildId: "10", buildNumber: 1, snapshots: [snap("a", [cmp()], { name: "home" }), snap("b", [cmp()], { name: "about" })] },
    ];
    const rows = noisiestSnapshots(builds);
    expect(rows.map((r) => r.name)).toEqual(["home", "about"]);
    expect(rows[0]).toMatchObject({ appearances: 3, withDiff: 2, lastSeenBuild: 3 });
    expect(rows[0].diffRatePct).toBeCloseTo(66.67, 1);
    expect(rows[0].averageRatio).toBeCloseTo(0.15, 5);
    expect(rows[1]).toMatchObject({ withDiff: 1, lastSeenBuild: 2 });
  });

  it("leaves out snapshots seen once or never changed", () => {
    const builds = [{ buildId: "1", buildNumber: 1, snapshots: [snap("a", [cmp({ diffRatio: 0.5 })])] }];
    expect(noisiestSnapshots(builds)).toEqual([]);
  });
});

describe("C2 diffDistribution", () => {
  it("buckets diffs and measures noise removed by AI", () => {
    const d = diffDistribution([
      snap("a", [cmp({ diffRatio: 0.4, aiDiffRatio: 0.2 })]),
      snap("b", [cmp({ diffRatio: 0.005, aiDiffRatio: 0.005 })]),
      snap("c", [cmp()]),
    ]);
    expect(d.comparisonsWithDiff).toBe(2);
    expect(d.buckets.find((b) => b.key === "lt1")?.count).toBe(1);
    expect(d.buckets.find((b) => b.key === "10to25")?.count).toBe(1);
    // raw 0.405, ai 0.205 -> about 49.4% removed
    expect(d.noiseRemovedPct).toBeCloseTo(49.38, 1);
    expect(d.top[0].ratio).toBe(0.2);
  });

  it("has no noise figure when AI did not run", () => {
    expect(diffDistribution([snap("a", [cmp({ diffRatio: 0.1 })])]).noiseRemovedPct).toBeNull();
  });
});

describe("C3 aiEffectiveness", () => {
  it("counts diffs cleared by AI and AI failures", () => {
    const ai = aiEffectiveness([
      snap("a", [
        cmp({ diffRatio: 0.3, aiDiffRatio: 0, ai: { enabled: true, visualDiffs: 0, processingStatus: "completed", summary: null } }),
        cmp({ diffRatio: 0.2, aiDiffRatio: 0.1, ai: { enabled: true, visualDiffs: 2, processingStatus: "completed", summary: null } }),
        cmp({ diffRatio: 0.2, aiFailureReason: "timeout" }),
      ]),
    ]);
    expect(ai).toMatchObject({ comparisons: 3, aiEnabled: 2, aiCompleted: 2, aiFailed: 1, rawDiffs: 3, cleared: 1, aiDiffs: 1, visualDiffs: 2 });
    expect(ai.failureReasons).toEqual([{ reason: "timeout", count: 1 }]);
  });
});

describe("C4 reviewBreakdown", () => {
  it("separates auto-approved from human-approved and counts outstanding", () => {
    const r = reviewBreakdown([
      snap("a", [], { reviewState: "approved", reviewStateReason: "auto_approved_branch" }),
      snap("b", [], { reviewState: "approved", reviewStateReason: "all_snapshots_approved" }),
      snap("c", [], { reviewState: "approved", reviewStateReason: "no_diffs" }),
      snap("d", [], { reviewState: "unreviewed" }),
      snap("e", [], { reviewState: "changes_requested", reviewStateReason: "changes_requested_snapshot" }),
    ]);
    expect(r.autoApproved).toBe(1);
    expect(r.humanApproved).toBe(1);
    expect(r.outstanding).toBe(2);
    expect(r.states.find((s) => s.state === "approved")?.count).toBe(3);
  });
});

describe("C5 commentHotspots", () => {
  it("lists snapshots with open comments, most first", () => {
    const c = commentHotspots([snap("a", [], { openComments: 1 }), snap("b", [], { openComments: 4 }), snap("c", [], { openComments: 0 })]);
    expect(c.total).toBe(5);
    expect(c.snapshotsWithComments).toBe(2);
    expect(c.top.map((t) => t.snapshotId)).toEqual(["b", "a"]);
  });
});

describe("C6 renderingRisk", () => {
  it("counts rendering flags and lists layout warnings", () => {
    const r = renderingRisk([
      snap("a", [], { enableJavascript: true, scopeSelector: ".main" }),
      snap("b", [], { enableLayout: true, layoutWarning: "Layout shifted" }),
      snap("c", []),
    ]);
    expect(r).toMatchObject({ total: 3, javascriptEnabled: 1, layoutEnabled: 1, withScopeSelector: 1, withLayoutWarning: 1 });
    expect(r.warnings[0]).toMatchObject({ snapshotId: "b", warning: "Layout shifted" });
  });
});

describe("C7 testCaseTraceability", () => {
  it("groups by test case and keeps the debug link of the worst diff", () => {
    const rows = testCaseTraceability([
      snap("a", [cmp({ diffRatio: 0.1, externalDebugUrl: "https://s/1" })], { testCaseName: "login" }),
      snap("b", [cmp({ diffRatio: 0.3, externalDebugUrl: "https://s/2" })], { testCaseName: "login" }),
      snap("c", [cmp()], { testCaseName: "cart" }),
      snap("d", [cmp({ diffRatio: 0.9 })]),
    ]);
    expect(rows.map((r) => r.testCase)).toEqual(["login", "cart"]);
    expect(rows[0]).toMatchObject({ snapshots: 2, withDiff: 2, debugUrl: "https://s/2" });
    expect(rows[0].averageRatio).toBeCloseTo(0.2, 5);
  });
});

describe("C8 responsiveAnalysis", () => {
  it("computes the diff rate per width and per browser", () => {
    const firefox = { name: null, osName: "Linux", osVersion: null, browserName: "firefox", browserVersion: null, orientation: null, resolution: null };
    const r = responsiveAnalysis([
      snap("a", [cmp({ width: 375, diffRatio: 0.1 }), cmp({ width: 1280 }), cmp({ width: 375, diffRatio: 0.2, device: firefox })]),
    ]);
    const w375 = r.byWidth.find((x) => x.key === "375");
    expect(w375).toMatchObject({ comparisons: 2, withDiff: 2, diffRatePct: 100 });
    expect(r.byWidth[0].key).toBe("375");
    expect(r.byBrowser.find((x) => x.key === "chrome")).toMatchObject({ comparisons: 2, withDiff: 1, diffRatePct: 50 });
    expect(r.byBrowser.find((x) => x.key === "firefox")).toMatchObject({ comparisons: 1, withDiff: 1 });
  });
});
