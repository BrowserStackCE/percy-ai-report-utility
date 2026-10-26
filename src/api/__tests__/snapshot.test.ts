import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSnapshot } from "../snapshots/snapshotsApi";
import { parseSnapshotResponse } from "../snapshots/mapper";

// Shape modelled on the documented GET /snapshots/:id response: `data` is a single object.
const body = (over: Record<string, unknown> = {}) => ({
  data: {
    type: "snapshots",
    id: "1001",
    attributes: {
      name: "Home page",
      "review-state": "unreviewed",
      "review-state-reason": "unreviewed_comparisons",
      "total-open-comments": 1,
      "enable-javascript": true,
      "test-case-id": "12",
      "test-case-name": "Checkout",
    },
    relationships: {
      build: { data: { type: "builds", id: "30453077" } },
      comparisons: { data: [{ type: "comparisons", id: "2001" }] },
    },
  },
  included: [
    {
      type: "comparisons",
      id: "2001",
      attributes: {
        state: "finished",
        width: 1080,
        "diff-ratio": 0.2,
        "ai-diff-ratio": 0.0329,
        "ai-processing-state": "completed",
        "ai-details": { "ai-enabled": true, "ai-visual-diffs": 2, "ai-summary": "Minor visual differences detected" },
        "external-debug-url": "https://automate.browserstack.com/builds/x/sessions/y",
      },
      relationships: { "comparison-tag": { data: { type: "comparison-tags", id: "2111" } } },
    },
    {
      type: "comparison-tags",
      id: "2111",
      attributes: { name: "Samsung Galaxy S22 Ultra", "os-name": "Android", "os-version": "12", "browser-name": "chrome" },
    },
  ],
  ...over,
});

describe("parseSnapshotResponse", () => {
  it("maps the single snapshot and its comparisons", () => {
    const s = parseSnapshotResponse(body());
    expect(s).toMatchObject({
      id: "1001",
      buildId: "30453077",
      name: "Home page",
      reviewState: "unreviewed",
      openComments: 1,
      enableJavascript: true,
      testCaseName: "Checkout",
    });
    expect(s.comparisons).toHaveLength(1);
    expect(s.comparisons[0]).toMatchObject({
      aiDiffRatio: 0.0329,
      diffRatio: 0.2,
      ai: { enabled: true, visualDiffs: 2 },
      device: { name: "Samsung Galaxy S22 Ultra", osName: "Android" },
    });
  });

  it("tolerates a snapshot without included resources", () => {
    const s = parseSnapshotResponse({ data: { type: "snapshots", id: 7 } });
    expect(s.id).toBe("7");
    expect(s.comparisons).toEqual([]);
  });

  it.each([null, "x", [], {}, { data: [] }, { data: {} }])("rejects a wrong shape: %j", (bad) => {
    expect(() => parseSnapshotResponse(bad)).toThrow(/unexpected response/);
  });
});

describe("fetchSnapshot", () => {
  const auth = { header: "Basic x", kind: "basic" as const };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch(status: number, json: unknown) {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(String(url));
        return { status, headers: { get: () => null }, json: async () => json };
      }),
    );
    return seen;
  }

  it("requests the snapshot by id", async () => {
    const seen = stubFetch(200, body());
    const s = await fetchSnapshot("1001", { auth });
    expect(s.id).toBe("1001");
    expect(seen[0]).toBe("/percy-api/snapshots/1001");
  });

  it("encodes the id so it cannot change the path", async () => {
    const seen = stubFetch(200, body());
    await fetchSnapshot("1/../2", { auth });
    expect(seen[0]).toBe("/percy-api/snapshots/1%2F..%2F2");
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [429, "rate_limited"],
    [500, "server"],
  ])("surfaces HTTP %i as %s", async (status, kind) => {
    stubFetch(status, {});
    await expect(fetchSnapshot("1001", { auth })).rejects.toMatchObject({ kind, status });
  });
});
