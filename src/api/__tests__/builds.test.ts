import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchBuildsPage } from "../builds/buildsApi";
import { BUILDS_PAGE_SIZE, parseBuildsResponse } from "../builds/mapper";

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
      snapshotsWithDiffs: 1,
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
