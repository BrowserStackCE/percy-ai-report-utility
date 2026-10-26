import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSnapshotsPage } from "../snapshots/snapshotsApi";
import { SNAPSHOTS_PAGE_SIZE, parseSnapshotsResponse } from "../snapshots/mapper";

// Shapes modelled on the documented GET /snapshots response (ids are made up).
const rawSnapshot = (id: number, over: Record<string, unknown> = {}, comparisonIds: number[] = [200 + id]) => ({
  type: "snapshots",
  id: String(id),
  attributes: {
    name: `snap-${id}`,
    "review-state": "unreviewed",
    "review-state-reason": "unreviewed_comparisons",
    "total-open-comments": 0,
    "is-reintroduced": false,
    "test-case-id": "12",
    "test-case-name": "Checkout",
    ...over,
  },
  relationships: {
    build: { data: { type: "builds", id: "30453077" } },
    comparisons: { data: comparisonIds.map((c) => ({ type: "comparisons", id: String(c) })) },
  },
});

const included = (comparisonId: number) => [
  {
    type: "comparisons",
    id: String(comparisonId),
    attributes: {
      state: "finished",
      width: 1080,
      "diff-ratio": null,
      "ai-diff-ratio": 0.0329,
      "ai-processing-state": "completed",
      "ai-details": { "ai-enabled": true, "ai-visual-diffs": 2, "ai-summary": "Minor visual differences detected" },
      "external-debug-url": "https://automate.browserstack.com/builds/x/sessions/y",
    },
    relationships: {
      "head-screenshot": { data: { type: "screenshots", id: "300" } },
      "comparison-tag": { data: { type: "comparison-tags", id: "2111" } },
    },
  },
  { type: "screenshots", id: "300", relationships: { image: { data: { type: "images", id: "400" } } } },
  { type: "images", id: "400", attributes: { url: "https://images.percy.io/abc", width: 1080, height: 2106 } },
  {
    type: "comparison-tags",
    id: "2111",
    attributes: { name: "Samsung Galaxy S22 Ultra", "os-name": "Android", "os-version": "12", "browser-name": "chrome" },
  },
];

describe("parseSnapshotsResponse", () => {
  it("maps snapshot attributes and keeps Percy's order", () => {
    const page = parseSnapshotsResponse({ data: [rawSnapshot(9), rawSnapshot(8)] });
    expect(page.snapshots.map((s) => s.id)).toEqual(["9", "8"]);
    expect(page.snapshots[0]).toMatchObject({
      buildId: "30453077",
      name: "snap-9",
      reviewState: "unreviewed",
      reviewStateReason: "unreviewed_comparisons",
      openComments: 0,
      isReintroduced: false,
      testCaseId: "12",
      testCaseName: "Checkout",
    });
    expect(page.nextCursor).toBeNull();
  });

  it("resolves comparisons, the head screenshot image, the device and AI details from `included`", () => {
    const [s] = parseSnapshotsResponse({ data: [rawSnapshot(1)], included: included(201) }).snapshots;
    expect(s.comparisons).toHaveLength(1);
    expect(s.comparisons[0]).toMatchObject({
      id: "201",
      state: "finished",
      width: 1080,
      diffRatio: null,
      aiDiffRatio: 0.0329,
      imageUrl: "https://images.percy.io/abc",
      imageWidth: 1080,
      imageHeight: 2106,
      externalDebugUrl: "https://automate.browserstack.com/builds/x/sessions/y",
    });
    expect(s.comparisons[0].ai).toMatchObject({ enabled: true, visualDiffs: 2, summary: "Minor visual differences detected" });
    expect(s.comparisons[0].device).toMatchObject({ name: "Samsung Galaxy S22 Ultra", osName: "Android", osVersion: "12" });
  });

  it("returns the last id as the next cursor when a full page came back", () => {
    const data = Array.from({ length: SNAPSHOTS_PAGE_SIZE }, (_, i) => rawSnapshot(100 - i));
    expect(parseSnapshotsResponse({ data }).nextCursor).toBe(100 - (SNAPSHOTS_PAGE_SIZE - 1));
  });

  it("tolerates unknown review states, missing attributes and comparisons missing from `included`", () => {
    const [odd, bare] = parseSnapshotsResponse({
      data: [rawSnapshot(2, { "review-state": "brand_new" }), { type: "snapshots", id: "7" }],
    }).snapshots;
    expect(odd.reviewState).toBe("unknown");
    expect(odd.comparisons).toEqual([]);
    expect(bare.name).toBe("Snapshot 7");
    expect(bare.reviewState).toBe("unknown");
    expect(bare.openComments).toBeNull();
  });

  it("skips entries without an id", () => {
    const page = parseSnapshotsResponse({ data: [rawSnapshot(1), { type: "snapshots" }] });
    expect(page.snapshots.map((s) => s.id)).toEqual(["1"]);
  });

  it.each([null, "x", [], {}, { data: {} }])("rejects a wrong shape: %j", (bad) => {
    expect(() => parseSnapshotsResponse(bad)).toThrow(/unexpected response/);
  });
});

describe("fetchSnapshotsPage", () => {
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

  it("requests the build's snapshots with the page size and no cursor on the first page", async () => {
    const seen = stubFetch(200, { data: [rawSnapshot(5)] });
    const page = await fetchSnapshotsPage({ auth, buildId: "42" });
    expect(page.snapshots).toHaveLength(1);
    expect(seen[0]).toMatch(/^\/percy-api\/snapshots\?/);
    expect(seen[0]).toContain("build_id=42");
    expect(seen[0]).toContain("page%5Blimit%5D=30");
    expect(seen[0]).not.toContain("cursor");
    expect(seen[0]).not.toContain("filter");
  });

  it("sends the cursor for later pages", async () => {
    const seen = stubFetch(200, { data: [] });
    await fetchSnapshotsPage({ auth, buildId: "42", cursor: 71 });
    expect(seen[0]).toContain("page%5Bcursor%5D=71");
  });

  it("sends the search and repeats the review-state-reason array key once per value", async () => {
    const seen = stubFetch(200, { data: [] });
    await fetchSnapshotsPage({
      auth,
      buildId: "42",
      filters: { search: " home ", reviewStateReasons: ["no_diffs", "unreviewed_comparisons"] },
    });
    expect(seen[0]).toContain("filter%5Bsearch%5D=home");
    expect(seen[0]).toContain("filter%5Breview-state-reason%5D%5B%5D=no_diffs");
    expect(seen[0]).toContain("filter%5Breview-state-reason%5D%5B%5D=unreviewed_comparisons");
  });

  it("omits empty filters", async () => {
    const seen = stubFetch(200, { data: [] });
    await fetchSnapshotsPage({ auth, buildId: "42", filters: { search: "  ", reviewStateReasons: [" ", ""] } });
    expect(seen[0]).not.toContain("filter");
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "server"],
  ])("surfaces HTTP %i as %s", async (status, kind) => {
    stubFetch(status, {});
    await expect(fetchSnapshotsPage({ auth, buildId: "42" })).rejects.toMatchObject({ kind, status });
  });
});
