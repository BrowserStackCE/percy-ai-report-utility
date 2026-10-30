import { beforeEach, describe, expect, it } from "vitest";
import { cacheKey, clearDataCache, onDataCacheCleared, readCache, writeCache } from "../dataCache";
import { parseSnapshotsResponse } from "../snapshots/mapper";
import { aggregateSnapshots } from "../snapshots/aggregate";

// Shapes taken from a real web (Chrome/Edge/Firefox/Safari) Percy build with Percy AI on.
const regions = [
  {
    type: "ai",
    ignored: true,
    change_type: "Text",
    change_title: "Navigation wraps",
    change_reason: "Dynamic label",
    change_description: "The toggle label changes from A to B.",
  },
  {
    type: "ai",
    ignored: false,
    change_type: "Shift",
    change_title: "Hero repositioned",
    change_reason: "Layout shift",
    change_description: "The hero heading moves down.",
  },
];

const snapshot = (id: number, name: string) => ({
  type: "snapshots",
  id: String(id),
  attributes: { name, "display-name": "PercyDemo - AI Report", "review-state": "unreviewed" },
  relationships: {
    build: { data: { type: "builds", id: "1" } },
    comparisons: { data: [{ type: "comparisons", id: String(id * 10) }] },
  },
});

const included = (id: number) => [
  {
    type: "comparisons",
    id: String(id * 10),
    attributes: {
      state: "finished",
      width: 375,
      "diff-ratio": 0.13,
      "ai-diff-ratio": 0.06,
      "ai-processing-state": "ai_completed",
      "ai-details": { "total-ai-visual-diffs": 3, "total-diffs-reduced": 3, "total-potential-bugs": 0 },
      "applied-regions": regions,
    },
    relationships: { browser: { data: { type: "browsers", id: "73" } } },
  },
  { type: "browsers", id: "73", attributes: { version: "143.0" }, relationships: { "browser-family": { data: { type: "browser-families", id: "2" } } } },
  { type: "browser-families", id: "2", attributes: { name: "Chrome", slug: "chrome" } },
];

describe("real Percy web payload", () => {
  const page = parseSnapshotsResponse({
    data: [snapshot(1, "Loop 01 - Home"), snapshot(2, "Loop 01 - About")],
    included: [...included(1), ...included(2).filter((r) => r.id !== "10" && r.id !== "73" && r.id !== "2")],
  });

  it("keeps each snapshot's own name, not the build-wide display name", () => {
    const aggregate = aggregateSnapshots(page.snapshots);
    expect(page.snapshots.map((s) => s.name)).toEqual(["Loop 01 - Home", "Loop 01 - About"]);
    expect(aggregate.topDiffs.map((t) => t.name).sort()).toEqual(["Loop 01 - About", "Loop 01 - Home"]);
  });

  it("reads Percy AI from the comparison fields Percy sends, and exposes every finding", () => {
    const ai = page.snapshots[0].comparisons[0].ai;
    expect(ai).toMatchObject({ enabled: true, visualDiffs: 3, processingStatus: "ai_completed", summary: "Hero repositioned" });
    expect(ai?.findings).toHaveLength(2);
    expect(ai?.findings[1]).toMatchObject({ title: "Hero repositioned", description: "The hero heading moves down.", ignored: false });
    expect(ai?.findings[0].ignored).toBe(true);
  });

  it("treats a comparison without any AI data as not run", () => {
    const p = parseSnapshotsResponse({
      data: [snapshot(5, "Plain")],
      included: [{ type: "comparisons", id: "50", attributes: { state: "finished", width: 375, "diff-ratio": 0.1 } }],
    });
    expect(p.snapshots[0].comparisons[0].ai).toBeNull();
  });

  it("reads the browser from comparison -> browser -> browser-family", () => {
    expect(page.snapshots[0].comparisons[0].device).toMatchObject({ browserName: "Chrome", browserVersion: "143.0" });
  });
});

describe("data cache", () => {
  beforeEach(() => clearDataCache());

  it("returns what was written and forgets it after a clear", () => {
    const key = cacheKey("builds", "p1", 10);
    writeCache(key, { n: 1 });
    expect(readCache(key)).toEqual({ n: 1 });
    clearDataCache();
    expect(readCache(key)).toBeUndefined();
  });

  it("tells subscribers when it is cleared, until they unsubscribe", () => {
    let calls = 0;
    const off = onDataCacheCleared(() => (calls += 1));
    clearDataCache();
    off();
    clearDataCache();
    expect(calls).toBe(1);
  });

  it("builds a different key for a different build count", () => {
    expect(cacheKey("analytics-builds", "p", 5)).not.toBe(cacheKey("analytics-builds", "p", 10));
  });
});
