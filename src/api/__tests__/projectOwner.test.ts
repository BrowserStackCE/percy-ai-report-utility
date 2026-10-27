import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../errors";
import { parseOrganizationOwner } from "../projects/mapper";
import { listProjects } from "../projects/projectsApi";

const member = (id: string, userId: string | null, owner: boolean) => ({
  type: "organization-users",
  id,
  attributes: { owner, role: owner ? "admin" : "member" },
  relationships: { user: { data: userId ? { type: "users", id: userId } : null } },
});
const user = (id: string, name: string | null) => ({ type: "users", id, attributes: { name } });

describe("parseOrganizationOwner", () => {
  it("returns the name of the member flagged as owner", () => {
    const json = {
      data: [member("1", "10", false), member("2", "20", true)],
      included: [user("10", "Member Person"), user("20", "Owner Person")],
    };
    expect(parseOrganizationOwner(json)).toBe("Owner Person");
  });

  it("returns null when nobody is flagged as owner", () => {
    expect(parseOrganizationOwner({ data: [member("1", "10", false)], included: [user("10", "Someone")] })).toBeNull();
  });

  it("returns null when the owner's user is missing, unnamed or not linked", () => {
    expect(parseOrganizationOwner({ data: [member("1", "10", true)], included: [] })).toBeNull();
    expect(parseOrganizationOwner({ data: [member("1", "10", true)], included: [user("10", null)] })).toBeNull();
    expect(parseOrganizationOwner({ data: [member("1", null, true)], included: [user("10", "X")] })).toBeNull();
  });

  it("tolerates a response without included users", () => {
    expect(parseOrganizationOwner({ data: [member("1", "10", true)] })).toBeNull();
  });

  it.each([null, "x", [], {}, { data: "nope" }])("rejects a wrong shape: %j", (bad) => {
    expect(() => parseOrganizationOwner(bad)).toThrow(ApiError);
  });
});

describe("listProjects owner lookup", () => {
  const auth = { header: "Basic x", kind: "basic" as const };

  const rawProject = (id: string, orgId: string) => ({
    type: "projects",
    id,
    attributes: { name: `Project ${id}`, slug: `p-${id}`, "full-slug": `org/p-${id}`, type: "web", product: "web" },
    relationships: { organization: { data: { type: "organizations", id: orgId } } },
  });
  const org = (id: string, slug: string) => ({ type: "organizations", id, attributes: { name: `Org ${slug}`, slug } });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Routes fetch by path: /projects returns `projects`, each org's members come from `members`. */
  function stubFetch(projects: unknown, members: Record<string, { status: number; body?: unknown }>) {
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const u = String(url);
        seen.push(u);
        const slug = /\/organizations\/([^/]+)\/organization-users/.exec(u)?.[1];
        const r = slug ? (members[slug] ?? { status: 404 }) : { status: 200, body: projects };
        return { status: r.status, headers: { get: () => null }, json: async () => r.body };
      }),
    );
    return seen;
  }

  it("attaches the owner to each project and asks once per organization, not per project", async () => {
    const seen = stubFetch(
      { data: [rawProject("1", "o1"), rawProject("2", "o1"), rawProject("3", "o2")], included: [org("o1", "alpha"), org("o2", "beta")], meta: { next_page: null } },
      {
        alpha: { status: 200, body: { data: [member("m1", "u1", true)], included: [user("u1", "Alice")] } },
        beta: { status: 200, body: { data: [member("m2", "u2", true)], included: [user("u2", "Bob")] } },
      },
    );
    const projects = await listProjects({ auth });
    expect(projects.map((p) => [p.id, p.organization?.ownerName])).toEqual([
      ["1", "Alice"],
      ["2", "Alice"],
      ["3", "Bob"],
    ]);
    expect(seen.filter((u) => u.includes("/organization-users"))).toHaveLength(2);
    expect(seen.find((u) => u.includes("/organizations/alpha/"))).toContain("include=user");
  });

  it("still loads the projects when the owner lookup is refused", async () => {
    stubFetch(
      { data: [rawProject("1", "o1")], included: [org("o1", "alpha")], meta: { next_page: null } },
      { alpha: { status: 403 } },
    );
    const [p] = await listProjects({ auth });
    expect(p.name).toBe("Project 1");
    expect(p.organization?.name).toBe("Org alpha");
    expect(p.organization?.ownerName).toBeNull();
  });

  it("leaves projects without an organization untouched and makes no member request", async () => {
    const noOrg = { ...rawProject("1", "o1"), relationships: {} };
    const seen = stubFetch({ data: [noOrg], meta: { next_page: null } }, {});
    const [p] = await listProjects({ auth });
    expect(p.organization).toBeNull();
    expect(seen.some((u) => u.includes("/organization-users"))).toBe(false);
  });

  it("propagates a cancelled load instead of swallowing it", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/organization-users")) {
          controller.abort();
          throw new DOMException("aborted", "AbortError");
        }
        return {
          status: 200,
          headers: { get: () => null },
          json: async () => ({ data: [rawProject("1", "o1")], included: [org("o1", "alpha")], meta: { next_page: null } }),
        };
      }),
    );
    await expect(listProjects({ auth, signal: controller.signal })).rejects.toBeDefined();
  });
});
