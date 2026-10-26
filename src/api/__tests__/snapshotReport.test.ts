import { describe, expect, it } from "vitest";
import { aiProblemOf, percySnapshotUrl, rankComparisons, severityOf, snapshotMetrics } from "../snapshots/report";
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
  device: null,
  ...over,
});

const snap = (comparisons: SnapshotComparison[]): Snapshot => ({
  id: "1",
  buildId: "9",
  name: "Home",
  displayName: null,
  reviewState: "unreviewed",
  reviewStateReason: null,
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
});

describe("severityOf", () => {
  it.each([
    [0, "none"],
    [0.005, "minor"],
    [0.01, "moderate"],
    [0.0999, "moderate"],
    [0.1, "major"],
    [0.8, "major"],
  ])("%s -> %s", (ratio, severity) => {
    expect(severityOf(ratio)).toBe(severity);
  });
});

describe("rankComparisons", () => {
  it("ranks by AI-filtered share, falling back to the raw share, biggest first", () => {
    const ranked = rankComparisons(
      snap([cmp({ id: "a", diffRatio: 0.2, aiDiffRatio: 0.01 }), cmp({ id: "b", diffRatio: 0.05 }), cmp({ id: "c" })]),
    );
    expect(ranked.map((r) => r.comparison.id)).toEqual(["b", "a", "c"]);
    expect(ranked[1]).toMatchObject({ ratio: 0.01, severity: "moderate" });
  });

  it("computes noise removed only when both ratios exist and never below zero", () => {
    const ranked = rankComparisons(
      snap([cmp({ id: "a", diffRatio: 0.2, aiDiffRatio: 0.05 }), cmp({ id: "b", diffRatio: 0.1 }), cmp({ id: "c", diffRatio: 0.01, aiDiffRatio: 0.02 })]),
    );
    const byId = (id: string) => ranked.find((r) => r.comparison.id === id)!;
    expect(byId("a").noiseRemoved).toBeCloseTo(0.15);
    expect(byId("b").noiseRemoved).toBeNull();
    expect(byId("c").noiseRemoved).toBe(0);
  });
});

describe("aiProblemOf", () => {
  it("reports a failure reason, an unfinished run, and nothing when fine or not in use", () => {
    expect(aiProblemOf(cmp({ aiFailureReason: "timeout" }))).toBe("timeout");
    expect(aiProblemOf(cmp({ ai: { enabled: true, visualDiffs: 0, processingStatus: null, summary: null }, aiProcessingState: "in_progress" }))).toBe("AI is in progress");
    expect(aiProblemOf(cmp({ ai: { enabled: true, visualDiffs: 0, processingStatus: null, summary: null }, aiProcessingState: "completed" }))).toBeNull();
    expect(aiProblemOf(cmp({ aiProcessingState: "in_progress" }))).toBeNull();
  });
});

describe("snapshotMetrics", () => {
  it("summarises changed vs unchanged comparisons and the AI results", () => {
    const ai = { enabled: true, visualDiffs: 2, processingStatus: "completed", summary: null };
    const m = snapshotMetrics(
      snap([
        cmp({ id: "a", diffRatio: 0.2, aiDiffRatio: 0.1, ai, aiProcessingState: "completed" }),
        cmp({ id: "b", diffRatio: 0.02, aiDiffRatio: 0.02, ai, aiProcessingState: "failed", aiFailureReason: "oom" }),
        cmp({ id: "c" }),
      ]),
    );
    expect(m).toMatchObject({ comparisons: 3, changed: 2, unchanged: 1, aiVisualDiffs: 4, aiAnalysed: 2, aiProblems: 1 });
    expect(m.maxRatio).toBeCloseTo(0.1);
    expect(m.averageRatio).toBeCloseTo(0.06);
    expect(m.averageNoiseRemoved).toBeCloseTo(0.05);
    expect(m.bySeverity).toEqual({ none: 1, minor: 0, moderate: 1, major: 1 });
  });

  it("returns nulls for a snapshot with nothing changed", () => {
    const m = snapshotMetrics(snap([cmp(), cmp()]));
    expect(m).toMatchObject({ changed: 0, unchanged: 2, maxRatio: null, averageRatio: null, averageNoiseRemoved: null });
  });

  it("handles a snapshot with no comparisons", () => {
    expect(snapshotMetrics(snap([]))).toMatchObject({ comparisons: 0, changed: 0, maxRatio: null });
  });
});

describe("percySnapshotUrl", () => {
  it("appends the snapshot id to the build URL and drops query and hash", () => {
    expect(percySnapshotUrl("https://percy.io/org/proj/builds/9?x=1#h", "42")).toBe("https://percy.io/org/proj/builds/9/42");
    expect(percySnapshotUrl("https://percy.io/org/proj/builds/9/", "42")).toBe("https://percy.io/org/proj/builds/9/42");
  });

  it("returns null without a usable http(s) URL", () => {
    expect(percySnapshotUrl(null, "42")).toBeNull();
    expect(percySnapshotUrl("not a url", "42")).toBeNull();
    expect(percySnapshotUrl("javascript:alert(1)", "42")).toBeNull();
  });
});
