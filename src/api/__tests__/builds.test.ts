import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBuild, fetchBuildsPage } from "../builds/buildsApi";
import { BUILDS_PAGE_SIZE, parseBuildResponse, parseBuildsResponse } from "../builds/mapper";

// Shapes modelled on the documented GET /builds response (ids are made up).
const rawBuild = (id: number, over: Record<string, unknown> = {}) => ({
  type: "builds",
  id: String(id),
  attributes: {
    branch: "main",
    "build-number": id,
    state: "finished",
    "review-state": "unreviewed",
    "total-snapshots": 4,
    "total-comparisons-diff": 1,
    "failure-reason": null,
    "web-url": `https://percy.io/org/proj/builds/${id}`,
    "created-at": "2026-06-01T10:00:00.000Z",
    ...over,
  },
  relationships: { project: { data: { type: "projects", id: "p1" } } },
});

describe("parseBuildsResponse", () => {
  it("maps builds and keeps the order Percy returned (newest first)", () => {
    const page = parseBuildsResponse({ data: [rawBuild(9), rawBuild(8)] });
    expect(page.builds.map((b) => b.id)).toEqual(["9", "8"]);
    const b = page.builds[0];
    expect(b).toMatchObject({
      projectId: "p1",
      buildNumber: 9,
      branch: "main",
      state: "finished",
      totalSnapshots: 4,
      comparisonsWithDiffs: 1,
      percyUrl: "https://percy.io/org/proj/builds/9",
    });
    expect(page.nextCursor).toBeNull();
  });

  it("returns the last id as the next cursor when a full page came back", () => {
    const data = Array.from({ length: BUILDS_PAGE_SIZE }, (_, i) => rawBuild(100 - i));
    expect(parseBuildsResponse({ data }).nextCursor).toBe(100 - (BUILDS_PAGE_SIZE - 1));
  });

  it("maps failed builds with a failure reason and tolerates unknown states", () => {
    const [failed, odd] = parseBuildsResponse({
      data: [rawBuild(2, { state: "failed", "failure-reason": "no_snapshots" }), rawBuild(1, { state: "brand_new" })],
    }).builds;
    expect(failed.state).toBe("failed");
    expect(failed.failureReason).toBe("no_snapshots");
    expect(odd.state).toBe("unknown");
  });

  it("skips entries without an id and tolerates missing attributes", () => {
    const page = parseBuildsResponse({ data: [rawBuild(1), { type: "builds" }, { type: "builds", id: "7" }] });
    expect(page.builds.map((b) => b.id)).toEqual(["1", "7"]);
    expect(page.builds[1].branch).toBeNull();
  });

  it.each([null, "x", [], {}, { data: {} }])("rejects a wrong shape: %j", (bad) => {
    expect(() => parseBuildsResponse(bad)).toThrow(/unexpected response/);
  });

  it("resolves the project name and commit from `included`", () => {
    const build = {
      ...rawBuild(9),
      relationships: {
        project: { data: { type: "projects", id: "p1" } },
        commit: { data: { type: "commits", id: "c1" } },
      },
    };
    const [b] = parseBuildsResponse({
      data: [build],
      included: [
        { type: "projects", id: "p1", attributes: { name: "Storefront" } },
        { type: "commits", id: "c1", attributes: { sha: "abcdef1234567", message: "Fix header\n\nbody", "author-name": "Ada" } },
      ],
    }).builds;
    expect(b.projectName).toBe("Storefront");
    expect(b.commit).toEqual({ sha: "abcdef1234567", message: "Fix header\n\nbody", author: "Ada" });
  });

  it("leaves project name and commit null when they are not included", () => {
    const [b] = parseBuildsResponse({ data: [rawBuild(1)] }).builds;
    expect(b.projectName).toBeNull();
    expect(b.commit).toBeNull();
  });

  it("maps the extended build fields: test cases, flags, actions, Figma and richer AI details", () => {
    const [b] = parseBuildsResponse({
      data: [
        rawBuild(3, {
          "total-test-cases": 12,
          "total-test-cases-unreviewed": 5,
          "total-test-cases-failed": 2,
          "testhub-build-uuid": "uuid-1",
          "total-comparisons-skipped-by-smartsnap": 7,
          "total-open-issues": 4,
          "has-partial-results": true,
          "self-approval-blocked": true,
          "prod-build": true,
          "build-processing-duration": 90,
          "build-count-for-average": 20,
          "cli-start-time": "2026-06-01T09:59:00.000Z",
          "action-reasons": "ui_change",
          "action-reasons-comment": "Intended redesign",
          "failed-by": "ci",
          "state-changing-feature-interactions": ["hover", 5, "click"],
          "figma-details": { figma_filename: "Design", figma_main_url: "https://figma.com/x", figma_flow_used: "A" },
          "ai-details": {
            "ai-enabled": true,
            "total-diffs-reduced-capped": 9,
            "total-comparisons-with-ai": 6,
            "summary-reason": "ok",
            "summary-partial-coverage": true,
            "remediation-status": "done",
          },
        }),
      ],
    }).builds;
    expect(b).toMatchObject({
      testCases: 12,
      testCasesUnreviewed: 5,
      testCasesFailed: 2,
      testhubBuildUuid: "uuid-1",
      smartSnapSkipped: 7,
      openIssues: 4,
      hasPartialResults: true,
      selfApprovalBlocked: true,
      prodBuild: true,
      designBuild: false,
      buildProcessingSeconds: 90,
      buildCountForAverage: 20,
      cliStartedAt: "2026-06-01T09:59:00.000Z",
      actionReasons: "ui_change",
      actionReasonsComment: "Intended redesign",
      failedBy: "ci",
    });
    expect(b.featureInteractions).toEqual(["hover", "click"]);
    expect(b.figma).toEqual({ fileName: "Design", url: "https://figma.com/x", flow: "A" });
    expect(b.ai).toMatchObject({
      enabled: true,
      diffsReducedCapped: 9,
      comparisonsWithAi: 6,
      summaryReason: "ok",
      summaryPartialCoverage: true,
      remediationStatus: "done",
    });
  });

  it("defaults the extended fields safely when Percy omits them", () => {
    const [b] = parseBuildsResponse({ data: [rawBuild(4)] }).builds;
    expect(b.testCasesUnreviewed).toBeNull();
    expect(b.hasPartialResults).toBe(false);
    expect(b.featureInteractions).toEqual([]);
    expect(b.figma).toBeNull();
    expect(b.cliStartedAt).toBeNull();
  });

  it("maps AI details, timing metrics and error buckets, and tolerates their absence", () => {
    const [full, bare] = parseBuildsResponse({
      data: [
        rawBuild(2, {
          "ai-details": { "ai-enabled": true, "total-potential-bugs": 3, "total-ai-visual-diffs": 5, "all-ai-jobs-completed": true, "summary-status": "completed" },
          "timing-metrics": { queued_duration: 4, processing_seconds: 12, queue_wait_avg_seconds: 1, queue_wait_max_seconds: 2 },
          "error-buckets": [{ bucket: "timeout", bucket_display_name: "Timed out" }, { bucket: "other" }],
        }),
        rawBuild(1),
      ],
    }).builds;
    expect(full.ai).toMatchObject({ enabled: true, potentialBugs: 3, aiVisualDiffs: 5, allJobsCompleted: true, summaryStatus: "completed" });
    expect(full.timings).toEqual({ queuedSeconds: 4, processingSeconds: 12, queueWaitAvgSeconds: 1, queueWaitMaxSeconds: 2 });
    expect(full.errorBuckets).toEqual(["Timed out", "other"]);
    expect(bare.ai).toBeNull();
    expect(bare.timings).toBeNull();
    expect(bare.errorBuckets).toEqual([]);
  });
});

describe("parseBuildResponse", () => {
  it("maps a single build resource", () => {
    const b = parseBuildResponse({ data: rawBuild(7, { "parallel-total-shards": 3 }) });
    expect(b).toMatchObject({ id: "7", buildNumber: 7, parallelShards: "3" });
  });

  it.each([null, "x", [], {}, { data: [] }, { data: { type: "builds" } }])("rejects a wrong shape: %j", (bad) => {
    expect(() => parseBuildResponse(bad)).toThrow(/unexpected response|without an id/);
  });
});

describe("fetchBuildsPage", () => {
  const auth = { header: "Basic x", kind: "basic" as const };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(status: number, body: unknown) {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(String(url));
        return { status, headers: { get: () => null }, json: async () => body };
      }),
    );
    return seen;
  }

  it("requests the project's builds with the page size and no cursor on the first page", async () => {
    const seen = stubFetch(200, { data: [rawBuild(5)] });
    const page = await fetchBuildsPage({ auth, projectId: "p1" });
    expect(page.builds).toHaveLength(1);
    expect(seen[0]).toMatch(/^\/percy-api\/builds\?/);
    expect(seen[0]).toContain("project_id=p1");
    expect(seen[0]).toContain("page%5Blimit%5D=30");
    expect(seen[0]).not.toContain("cursor");
  });

  it("sends the cursor for older pages", async () => {
    const seen = stubFetch(200, { data: [] });
    await fetchBuildsPage({ auth, projectId: "p1", cursor: 71 });
    expect(seen[0]).toContain("page%5Bcursor%5D=71");
  });

  it("sends the branch, state and sha filters as Percy filter[...] params", async () => {
    const seen = stubFetch(200, { data: [] });
    await fetchBuildsPage({ auth, projectId: "p1", filters: { branch: " main ", state: "failed", sha: "abc123" } });
    expect(seen[0]).toContain("filter%5Bbranch%5D=main");
    expect(seen[0]).toContain("filter%5Bstate%5D=failed");
    expect(seen[0]).toContain("filter%5Bsha%5D=abc123");
  });

  it("omits empty filters", async () => {
    const seen = stubFetch(200, { data: [] });
    await fetchBuildsPage({ auth, projectId: "p1", filters: { branch: "  ", state: "" } });
    expect(seen[0]).not.toContain("filter");
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [429, "rate_limited"],
    [500, "server"],
  ])("surfaces HTTP %i as %s", async (status, kind) => {
    stubFetch(status, {});
    await expect(fetchBuildsPage({ auth, projectId: "p1" })).rejects.toMatchObject({ kind, status });
  });
});

describe("fetchBuild", () => {
  const auth = { header: "Basic x", kind: "basic" as const };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests /builds/:id and maps the build", async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(String(url));
        return { status: 200, headers: { get: () => null }, json: async () => ({ data: rawBuild(42) }) };
      }),
    );
    const b = await fetchBuild("42", { auth });
    expect(seen[0]).toBe("/percy-api/builds/42");
    expect(b.id).toBe("42");
  });

  it("reports a missing build as not_found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 404, headers: { get: () => null }, json: async () => ({}) })));
    await expect(fetchBuild("1", { auth })).rejects.toMatchObject({ kind: "not_found", status: 404 });
  });
});
