import { describe, expect, it } from "vitest";
import { parseBuildsResponse } from "../builds/mapper";
import type { Build } from "../builds/types";
import {
  buildTrend,
  failureAnalysis,
  median,
  parallelIntegrity,
  percentile,
  pullRequestQuality,
  reviewSla,
  reviewerWorkload,
} from "../builds/analytics";

const raw = (id: number, attrs: Record<string, unknown> = {}, relationships: Record<string, unknown> = {}) => ({
  type: "builds",
  id: String(id),
  attributes: {
    branch: "main",
    "build-number": id,
    state: "finished",
    "review-state": "unreviewed",
    "total-comparisons-diff": 0,
    "created-at": "2026-06-01T10:00:00.000Z",
    ...attrs,
  },
  relationships: { project: { data: { type: "projects", id: "p1" } }, ...relationships },
});

const make = (rows: ReturnType<typeof raw>[], included?: unknown[]): Build[] =>
  parseBuildsResponse({ data: rows, included }).builds;

describe("median / percentile", () => {
  it("handles empty, odd and even inputs", () => {
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(percentile([], 90)).toBeNull();
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
  });
});

describe("B1 buildTrend", () => {
  it("counts builds per day, fills gap days and computes the diff rate", () => {
    const builds = make([
      raw(1, { "created-at": "2026-06-01T10:00:00", "review-state": "approved", "total-comparisons-diff": 2 }),
      raw(2, { "created-at": "2026-06-01T12:00:00", state: "failed" }),
      raw(3, { "created-at": "2026-06-03T09:00:00", "review-state": "rejected" }),
    ]);
    const t = buildTrend(builds);
    expect(t.totalBuilds).toBe(3);
    expect(t.days.map((d) => d.day)).toEqual(["2026-06-01", "2026-06-02", "2026-06-03"]);
    expect(t.days[0]).toMatchObject({ builds: 2, approved: 1, failed: 1, withDiffs: 1 });
    expect(t.days[1].builds).toBe(0);
    expect(t.days[2].rejected).toBe(1);
    // 2 finished builds (1 and 3), one with diffs.
    expect(t.diffRatePct).toBe(50);
  });

  it("returns an empty trend for no builds", () => {
    expect(buildTrend([])).toEqual({ days: [], totalBuilds: 0, diffRatePct: null });
  });
});

describe("B2 reviewSla", () => {
  it("measures finished to approved and lists the waiting queue, longest first", () => {
    const builds = make([
      raw(1, { "finished-at": "2026-06-01T10:00:00Z", "approved-at": "2026-06-01T11:00:00Z", "review-state": "approved" }),
      raw(2, { "finished-at": "2026-06-01T10:00:00Z", "approved-at": "2026-06-01T14:00:00Z", "review-state": "approved" }),
      raw(3, { "finished-at": "2026-06-01T08:00:00Z", "total-comparisons-diff": 3 }),
      raw(4, { "finished-at": "2026-06-01T09:00:00Z", "total-comparisons-diff": 1 }),
      raw(5, { "finished-at": "2026-06-01T09:00:00Z", "total-comparisons-diff": 0 }),
    ]);
    const now = new Date("2026-06-01T12:00:00Z").getTime();
    const sla = reviewSla(builds, now);
    expect(sla.reviewedCount).toBe(2);
    expect(sla.medianSeconds).toBe(2.5 * 3600);
    expect(sla.waiting.map((w) => w.build.id)).toEqual(["3", "4"]);
    expect(sla.waiting[0].waitingSeconds).toBe(4 * 3600);
  });
});

describe("B4 failureAnalysis", () => {
  it("groups failure reasons and finds builds that were never finalised", () => {
    const builds = make([
      raw(1, { state: "failed", "failure-reason": "missing_resources", "finalized-at": "2026-06-01T10:00:00Z" }),
      raw(2, { state: "failed", "failure-reason": "missing_resources" }),
      raw(3, { state: "failed" }),
      raw(4, { "failed-snapshots-count": 3, "finalized-at": "2026-06-01T10:00:00Z" }),
    ]);
    const f = failureAnalysis(builds);
    expect(f.failedBuilds).toBe(3);
    expect(f.failureRatePct).toBe(75);
    expect(f.reasons[0]).toEqual({ reason: "missing_resources", count: 2 });
    expect(f.reasons[1]).toEqual({ reason: "unknown", count: 1 });
    expect(f.buildsWithFailedSnapshots).toBe(1);
    expect(f.totalFailedSnapshots).toBe(3);
    expect(f.neverFinalized.map((b) => b.id)).toEqual(["2", "3"]);
  });
});

describe("B5 pullRequestQuality", () => {
  it("groups builds by PR number and reports the latest state", () => {
    const builds = make([
      raw(1, { "is-pull-request": true, "pull-request-number": 7, "pull-request-title": "Fix", "review-state": "rejected", "created-at": "2026-06-01T10:00:00Z", "total-comparisons-diff": 2 }),
      raw(2, { "is-pull-request": true, "pull-request-number": 7, "pull-request-title": "Fix", "review-state": "approved", "created-at": "2026-06-02T10:00:00Z" }),
      raw(3, { "is-pull-request": false }),
      raw(4, { "is-pull-request": true, "pull-request-number": 9, "created-at": "2026-06-01T10:00:00Z" }),
    ]);
    const rows = pullRequestQuality(builds);
    expect(rows.map((r) => r.number)).toEqual([7, 9]);
    expect(rows[0]).toMatchObject({ builds: 2, buildsWithDiffs: 1, rejectedOrChanges: 1, finalState: "approved" });
  });
});

describe("B6 parallelIntegrity", () => {
  it("finds partial builds and parallel runs with missing shards", () => {
    const builds = make([
      raw(1, { partial: true }),
      raw(2, { "parallel-nonce": "abc", "parallel-total-shards": 3 }),
      raw(3, { "parallel-nonce": "abc", "parallel-total-shards": 3 }),
      raw(4, { "parallel-nonce": "def", "parallel-total-shards": 1 }),
    ]);
    const p = parallelIntegrity(builds);
    expect(p.partialBuilds.map((b) => b.id)).toEqual(["1"]);
    expect(p.groups).toHaveLength(2);
    expect(p.incompleteGroups.map((g) => g.nonce)).toEqual(["abc"]);
  });
});

describe("B8 reviewerWorkload", () => {
  it("counts approvals per reviewer and groups unknown approvers", () => {
    const included = [{ type: "users", id: "u1", attributes: { name: "Asha" } }];
    const builds = make(
      [
        raw(1, { "review-state": "approved", "finished-at": "2026-06-01T10:00:00Z", "approved-at": "2026-06-01T11:00:00Z" }, { "approved-by": { data: { type: "users", id: "u1" } } }),
        raw(2, { "review-state": "approved", "finished-at": "2026-06-01T10:00:00Z", "approved-at": "2026-06-01T13:00:00Z" }, { "approved-by": { data: { type: "users", id: "u1" } } }),
        raw(3, { "review-state": "approved" }),
        raw(4, { "review-state": "unreviewed" }),
      ],
      included,
    );
    const rows = reviewerWorkload(builds);
    expect(rows[0]).toMatchObject({ reviewer: "Asha", approvals: 2, medianSeconds: 2 * 3600 });
    expect(rows[1]).toMatchObject({ reviewer: "Unknown", approvals: 1 });
  });
});