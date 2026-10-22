import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, errorFromStatus, isRetryable } from "../errors";
import { authFromCredentials } from "../http";
import { parseProjectsResponse } from "../projects/mapper";
import { listProjects } from "../projects/projectsApi";

// Shapes modelled on real GET /projects responses (ids and names are made up).
const rawProject = (id: string, over: Record<string, unknown> = {}) => ({
  type: "projects",
  id,
  attributes: {
    name: `Project ${id}`,
    slug: `project-${id}`,
    "full-slug": `org/project-${id}`,
    type: "automate",
    product: "web",
    "is-enabled": true,
    "default-base-branch": "main",
    "current-period-usage": 12,
    "screenshot-limit": null,
    "updated-at": "2026-06-01T10:14:22.000Z",
    ...over,
  },
  relationships: { organization: { data: { type: "organizations", id: "o1" } } },
});

const org = { type: "organizations", id: "o1", attributes: { name: "Acme", slug: "acme" } };

describe("parseProjectsResponse", () => {
  it("maps an array response with included organizations", () => {
    const page = parseProjectsResponse({
      data: [rawProject("1"), rawProject("2")],
      included: [org],
      meta: { next_page: 2 },
    });
    expect(page.projects).toHaveLength(2);
    expect(page.nextPage).toBe(2);
    const p = page.projects[0];
    expect(p.name).toBe("Project 1");
    expect(p.fullSlug).toBe("org/project-1");
    expect(p.kind).toBe("web");
    expect(p.organization?.name).toBe("Acme");
    expect(p.percyUrl).toBe("https://percy.io/org/project-1");
    expect(p.screenshotLimit).toBeNull();
  });

  it("maps a single-object response (project token)", () => {
    const page = parseProjectsResponse({ data: rawProject("9") });
    expect(page.projects).toHaveLength(1);
    expect(page.nextPage).toBeNull();
  });

  it("treats next_page null as the last page", () => {
    expect(parseProjectsResponse({ data: [], meta: { next_page: null } }).nextPage).toBeNull();
  });

  it("skips entries without a name/slug and tolerates missing attributes", () => {
    const page = parseProjectsResponse({
      data: [rawProject("1"), { type: "projects", id: "2" }, rawProject("3", { name: "", slug: "" })],
    });
    expect(page.projects.map((p) => p.id)).toEqual(["1"]);
  });

  it("leaves organization null when it is not included", () => {
    expect(parseProjectsResponse({ data: [rawProject("1")] }).projects[0].organization).toBeNull();
  });

  it("classifies app and unknown kinds", () => {
    const p = parseProjectsResponse({
      data: [rawProject("1", { product: "app", type: "app" }), rawProject("2", { product: undefined, type: "weird" })],
    }).projects;
    expect(p[0].kind).toBe("app");
    expect(p[1].kind).toBe("unknown");
  });

  it.each([
    ["web", "web", "web"],
    ["web", "automate", "web"],
    ["app", "app", "app"],
    ["visual_scanner", "visual_scanner", "web"],
    ["responsive_scanner", "responsive_scanner", "web"],
    ["something_new", "something_new", "unknown"],
  ])("classifies product=%s type=%s as %s (real Percy combinations)", (product, type, kind) => {
    const [p] = parseProjectsResponse({ data: [rawProject("1", { product, type })] }).projects;
    expect(p.kind).toBe(kind);
    expect(p.type).toBe(type);
  });

  it.each([null, "x", [], {}, { data: "nope" }])("rejects a wrong shape: %j", (bad) => {
    expect(() => parseProjectsResponse(bad)).toThrow(ApiError);
    try {
      parseProjectsResponse(bad);
    } catch (e) {
      expect((e as ApiError).kind).toBe("invalid_response");
    }
  });
});

describe("errorFromStatus", () => {
  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [404, "not_found"],
    [422, "unprocessable"],
    [429, "rate_limited"],
    [500, "server"],
    [503, "server"],
    [418, "unexpected"],
  ])("maps %i to %s", (status, kind) => {
    expect(errorFromStatus(status, "basic")?.kind).toBe(kind);
  });

  it("returns null for success", () => {
    expect(errorFromStatus(200, "basic")).toBeNull();
  });

  it("states the rate limit and honours Retry-After on 429", () => {
    const e = errorFromStatus(429, "token", "30")!;
    expect(e.message).toMatch(/400 read requests per minute/);
    expect(e.retryAfter).toBe(30);
    expect(e.hint).toMatch(/30s/);
    expect(errorFromStatus(429, "token", "soon")!.retryAfter).toBeUndefined();
  });

  it("words 401 in the singular for tokens and plural for credentials", () => {
    expect(errorFromStatus(401, "token")!.message).toMatch(/Percy token is invalid/);
    expect(errorFromStatus(401, "basic")!.message).toMatch(/credentials are invalid/);
  });

  it("only treats transient failures as retryable", () => {
    expect(isRetryable(errorFromStatus(429, "basic")!)).toBe(true);
    expect(isRetryable(errorFromStatus(503, "basic")!)).toBe(true);
    expect(isRetryable(errorFromStatus(401, "basic")!)).toBe(false);
    expect(isRetryable(errorFromStatus(403, "basic")!)).toBe(false);
  });
});

describe("authFromCredentials", () => {
  it("prefers BrowserStack credentials over a project token", () => {
    expect(authFromCredentials({})).toBeNull();
    expect(authFromCredentials({ percyToken: "t" })?.header).toBe("Token t");
    const both = authFromCredentials({ percyToken: "t", username: "u", accessKey: "k" })!;
    expect(both.kind).toBe("basic");
    expect(both.header).toBe(`Basic ${btoa("u:k")}`);
  });

  it("ignores half a BrowserStack pair", () => {
    expect(authFromCredentials({ username: "u" })).toBeNull();
  });
});

describe("listProjects", () => {
  const auth = { header: "Basic x", kind: "basic" as const };

  type FakeRes = { status: number; body?: unknown; headers?: Record<string, string> };

  /** Stub fetch with one response per cursor ("first" is the request without a cursor). */
  function stubFetch(pages: Record<string, FakeRes>) {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(String(url));
        const cursor = new URL(String(url), "http://x").searchParams.get("page[cursor]") ?? "first";
        const r = pages[cursor] ?? { status: 404 };
        return {
          status: r.status,
          headers: { get: (k: string) => r.headers?.[k.toLowerCase()] ?? null },
          json: async () => r.body,
        };
      }),
    );
    return seen;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("follows next_page, de-duplicates and sorts by name", async () => {
    const seen = stubFetch({
      first: { status: 200, body: { data: [rawProject("2"), rawProject("1")], meta: { next_page: 2 } } },
      "2": { status: 200, body: { data: [rawProject("1"), rawProject("3")], meta: { next_page: null } } },
    });
    const projects = await listProjects({ auth });
    expect(projects.map((p) => p.id)).toEqual(["1", "2", "3"]);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatch(/^\/percy-api\/projects\?/);
    expect(seen[0]).toContain("page%5Blimit%5D=50");
    expect(seen[1]).toContain("page%5Bcursor%5D=2");
  });

  it("stops if the cursor does not advance", async () => {
    const seen = stubFetch({
      first: { status: 200, body: { data: [rawProject("1")], meta: { next_page: 2 } } },
      "2": { status: 200, body: { data: [rawProject("2")], meta: { next_page: 2 } } },
    });
    expect(await listProjects({ auth })).toHaveLength(2);
    expect(seen).toHaveLength(2);
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [429, "rate_limited"],
    [500, "server"],
  ])("surfaces HTTP %i as %s", async (status, kind) => {
    stubFetch({ first: { status, headers: { "retry-after": "5" } } });
    await expect(listProjects({ auth })).rejects.toMatchObject({ kind, status });
  });

  it("reports a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await expect(listProjects({ auth })).rejects.toMatchObject({ kind: "network" });
  });

  it("reports a non-JSON body as invalid_response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        headers: { get: () => null },
        json: async () => {
          throw new SyntaxError("bad json");
        },
      })),
    );
    await expect(listProjects({ auth })).rejects.toMatchObject({ kind: "invalid_response" });
  });
});
